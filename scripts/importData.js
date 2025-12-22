const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const pool = require('../src/config/database');

// Paths
const PATH_CONSULTA = 'd:/projetorj/consulta_cand_2022/consulta_cand_2022_RJ.csv';
const PATH_ELEITORADO = 'd:/projetorj/eleitorado_local_votacao_2022/eleitorado_local_votacao_2022.csv';
const PATH_VOTACAO_RJ = 'd:/projetorj/votacao_secao_2022_RJ/votacao_secao_2022_RJ.csv';
const PATH_VOTACAO_BR = 'd:/projetorj/votacao_secao_2022_BR/votacao_secao_2022_BR.csv';

// In-Memory Maps
const sectionToLocalMap = new Map(); // Key: MUN-ZONA-DECAO -> LocalKey
const localDataMap = new Map();      // Key: LocalKey -> { data, dbId }
const candidateMap = new Map();      // Key: NR_CANDIDATO -> { nome, partido, cargo }
const votesMap = new Map();          // Key: LocalDbId|CandNum|Cargo -> votes

// Helper: Generate LocalKey
const getLocalKey = (mun, zona, localNum) => `${mun}-${zona}-${localNum}`;
// Helper: Generate SectionKey
const getSectionKey = (mun, zona, secao) => `${mun}-${zona}-${secao}`;

async function processVotingFile(filePath, fileLabel, filterFn) {
    console.log(`\nProcessando arquivo de votos: ${fileLabel}...`);
    return new Promise((resolve, reject) => {
        let count = 0;
        let processed = 0;
        fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('ISO-8859-1'))
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                count++;
                if (count % 1000000 === 0) process.stdout.write(`\rLidas: ${count} | Processadas: ${processed}`);

                // Apply custom filter (e.g. only President for BR file)
                if (filterFn && !filterFn(row)) return;

                const mun = row['CD_MUNICIPIO'];
                const zona = row['NR_ZONA'];
                const secao = row['NR_SECAO'];
                const candNum = row['NR_VOTAVEL'];
                const cdCargo = row['CD_CARGO'];

                const sectionKey = getSectionKey(mun, zona, secao);
                const localKey = sectionToLocalMap.get(sectionKey);

                if (!localKey) return;

                const local = localDataMap.get(localKey);
                if (!local || !local.dbId) return;

                let cand = candidateMap.get(candNum);

                // SPECIAL HANDLING FOR PRESIDENTE (CD_CARGO = 1)
                if (cdCargo === '1') {
                    // Always check for manual override for Top Candidates to ensure correct Name is used
                    // (e.g. 22 in RJ is Claudio Castro, but for President it MUST be Bolsonaro)
                    let forcedName = null;
                    let forcedParty = null;

                    if (candNum === '22') { forcedName = 'JAIR BOLSONARO'; forcedParty = 'PL'; }
                    else if (candNum === '13') { forcedName = 'LULA'; forcedParty = 'PT'; }
                    else if (candNum === '12') { forcedName = 'CIRO GOMES'; forcedParty = 'PDT'; }
                    else if (candNum === '15') { forcedName = 'SIMONE TEBET'; forcedParty = 'MDB'; }
                    else if (candNum === '95') { forcedName = 'BRANCO'; forcedParty = 'N/A'; }
                    else if (candNum === '96') { forcedName = 'NULO'; forcedParty = 'N/A'; }

                    if (forcedName) {
                        // Create or Override candidate object to ensure correct Presidential Name
                        cand = { nome: forcedName, partido: forcedParty, cargo: 'PRESIDENTE', numero: candNum };
                    } else if (!cand) {
                        // Fallback for others not in map
                        cand = { nome: `PRESIDENTE (${candNum})`, partido: 'N/A', cargo: 'PRESIDENTE', numero: candNum };
                    } else {
                        // Exists in map (minor candidates), just fix cargo and ensure we don't accidentally Clone the object reference if it's shared
                        cand = { ...cand, cargo: 'PRESIDENTE' };
                    }
                }

                const nome = cand ? cand.nome : (candNum == '95' ? 'BRANCO' : (candNum == '96' ? 'NULO' : 'OUTROS'));
                const partido = cand ? cand.partido : 'N/A';
                const cargo = cand ? cand.cargo : row['DS_CARGO'] || 'DESCONHECIDO';

                const votes = parseInt(row['QT_VOTOS']);

                // Aggregate Key: LocalDBID + CandNum + Cargo
                const aggKey = `${local.dbId}|${candNum}|${cargo}`;

                if (!votesMap.has(aggKey)) {
                    votesMap.set(aggKey, {
                        local_id: local.dbId,
                        candidato_numero: candNum,
                        candidato_nome: nome,
                        partido_sigla: partido,
                        cargo: cargo,
                        total_votos: 0
                    });
                }
                votesMap.get(aggKey).total_votos += votes;
                processed++;
            })
            .on('end', () => {
                console.log(`\n${fileLabel} Concluído. Linhas processadas: ${processed}`);
                resolve();
            })
            .on('error', reject);
    });
}

async function importData() {
    const client = await pool.connect();
    console.log('Iniciando importação completa (V2 - Correction)...');

    try {
        // 0. Init Schema
        console.log('Criando Schema...');
        const schemaSql = fs.readFileSync(path.join(__dirname, '../src/models/schema.sql'), 'utf8');
        await client.query(schemaSql);

        // 1. Process Eleitorado
        console.log('Lendo Eleitorado...');
        await new Promise((resolve, reject) => {
            let count = 0;
            fs.createReadStream(PATH_ELEITORADO)
                .pipe(iconv.decodeStream('ISO-8859-1'))
                .pipe(csv({ separator: ';' }))
                .on('data', (row) => {
                    const mun = row['CD_MUNICIPIO'];
                    const zona = row['NR_ZONA'];
                    const secao = row['NR_SECAO'];
                    const localNum = row['NR_LOCAL_VOTACAO'];

                    if (!mun || !zona || !secao || !localNum) return;

                    const localKey = getLocalKey(mun, zona, localNum);
                    const sectionKey = getSectionKey(mun, zona, secao);

                    sectionToLocalMap.set(sectionKey, localKey);

                    if (!localDataMap.has(localKey)) {
                        const lat = parseFloat(row['NR_LATITUDE'].replace(',', '.'));
                        const long = parseFloat(row['NR_LONGITUDE'].replace(',', '.'));

                        if (lat && long && lat !== 0 && long !== 0) {
                            localDataMap.set(localKey, {
                                id_tse: localKey,
                                nome_local: row['NM_LOCAL_VOTACAO'],
                                endereco: row['DS_ENDERECO'],
                                bairro: row['NM_BAIRRO'],
                                cidade: row['NM_MUNICIPIO'],
                                latitude: lat,
                                longitude: long,
                                dbId: null
                            });
                        }
                    }
                    count++;
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // 2. Insert Locais
        console.log(`Inserindo ${localDataMap.size} locais de votação...`);
        const locais = Array.from(localDataMap.values());
        const CHUNK_SIZE = 5000;
        for (let i = 0; i < locais.length; i += CHUNK_SIZE) {
            const chunk = locais.slice(i, i + CHUNK_SIZE);
            const values = [];
            const placeholders = [];
            chunk.forEach((loc, idx) => {
                const base = idx * 7;
                placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
                values.push(loc.id_tse, loc.nome_local, loc.endereco, loc.bairro, loc.cidade, loc.latitude, loc.longitude);
            });
            const query = `
            INSERT INTO locais_votacao (id_tse, nome_local, endereco, bairro, cidade, latitude, longitude)
            VALUES ${placeholders.join(',')}
            ON CONFLICT (id_tse) DO UPDATE SET nome_local = EXCLUDED.nome_local
            RETURNING id, id_tse;
        `;
            const res = await client.query(query, values);
            res.rows.forEach(row => {
                const loc = localDataMap.get(row.id_tse);
                if (loc) loc.dbId = row.id;
            });
            process.stdout.write(`\rLocais inseridos: ${Math.min(i + CHUNK_SIZE, locais.length)}`);
        }
        console.log('\nLocais inseridos.');

        // 3. Process Candidatos
        console.log('Lendo Candidatos...');
        await new Promise((resolve, reject) => {
            fs.createReadStream(PATH_CONSULTA)
                .pipe(iconv.decodeStream('ISO-8859-1'))
                .pipe(csv({ separator: ';' }))
                .on('data', (row) => {
                    const nr = row['NR_CANDIDATO'];
                    if (!nr) return;
                    candidateMap.set(nr, {
                        nome: row['NM_URNA_CANDIDATO'],
                        partido: row['SG_PARTIDO'],
                        cargo: row['DS_CARGO'],
                        numero: nr
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });
        console.log(`Candidatos carregados: ${candidateMap.size}`);

        // 4. Process Votes
        console.log('--- ETAPA 1: Processando Votos ESTADUAIS (RJ) ---');
        await processVotingFile(PATH_VOTACAO_RJ, 'RJ_VOTES', (row) => row['CD_CARGO'] !== '1');

        console.log('--- ETAPA 2: Processando Votos PRESIDENCIAIS (BR) ---');
        await processVotingFile(PATH_VOTACAO_BR, 'BR_PRESIDENT_VOTES', (row) => {
            return row['SG_UF'] === 'RJ' && row['CD_CARGO'] === '1';
        });

        // 5. Bulk Insert
        console.log(`\nInserindo ${votesMap.size} registros agregados...`);
        const allVotes = Array.from(votesMap.values());

        for (let i = 0; i < allVotes.length; i += CHUNK_SIZE) {
            const chunk = allVotes.slice(i, i + CHUNK_SIZE);
            const values = [];
            const placeholders = [];

            chunk.forEach((v, idx) => {
                const base = idx * 7;
                placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
                values.push(2022, v.cargo, v.candidato_nome, v.candidato_numero, v.partido_sigla, v.local_id, v.total_votos);
            });

            const query = `
            INSERT INTO votos_agregados (ano, cargo, candidato_nome, candidato_numero, partido_sigla, local_id, total_votos)
            VALUES ${placeholders.join(',')}
            ON CONFLICT (ano, cargo, candidato_numero, local_id) DO UPDATE
            SET total_votos = EXCLUDED.total_votos;
        `;

            await client.query(query, values);
            process.stdout.write(`\rVotos salvos: ${Math.min(i + CHUNK_SIZE, allVotes.length)}`);
        }

        console.log('\nIMPORTAÇÃO COMPLETA COM SUCESSO!');

    } catch (err) {
        console.error('Erro fatal:', err);
    } finally {
        client.release();
        process.exit();
    }
}

importData();
