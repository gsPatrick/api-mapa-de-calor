const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const pool = require('../src/config/database');

// Paths for 2018 data
const PATH_CONSULTA = 'd:/projetorj/2018/consulta_cand_2018/consulta_cand_2018_RJ.csv';
const PATH_VOTACAO_RJ = 'd:/projetorj/2018/votacao_secao_2018_RJ/votacao_secao_2018_RJ.csv';
const PATH_VOTACAO_BR = 'd:/projetorj/2018/votacao_secao_2018_BR/votacao_secao_2018_BR.csv';

// In-Memory Maps
const candidateMap = new Map();      // Key: NR_CANDIDATO -> { nome, partido, cargo }
const votesMap = new Map();          // Key: LocalDbId|CandNum|Cargo -> votes
const localMap = new Map();          // Key: id_tse -> dbId (from existing DB)

// Helper: Generate LocalKey (same format as 2022)
const getLocalKey = (mun, zona, localNum) => `${mun}-${zona}-${localNum}`;

async function loadExistingLocals() {
    console.log('Carregando locais de votação existentes do banco...');
    const result = await pool.query('SELECT id, id_tse FROM locais_votacao');
    result.rows.forEach(row => {
        localMap.set(row.id_tse, row.id);
    });
    console.log(`Locais carregados: ${localMap.size}`);
}

async function processVotingFile(filePath, fileLabel, filterFn) {
    console.log(`\nProcessando arquivo de votos: ${fileLabel}...`);
    return new Promise((resolve, reject) => {
        let count = 0;
        let processed = 0;
        let skippedNoLocal = 0;

        fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('ISO-8859-1'))
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                count++;
                if (count % 1000000 === 0) process.stdout.write(`\rLidas: ${count} | Processadas: ${processed} | Sem local: ${skippedNoLocal}`);

                // Apply custom filter (e.g. only President for BR file)
                if (filterFn && !filterFn(row)) return;

                const mun = row['CD_MUNICIPIO'];
                const zona = row['NR_ZONA'];
                const localNum = row['NR_LOCAL_VOTACAO'];
                const candNum = row['NR_VOTAVEL'];
                const cdCargo = row['CD_CARGO'];

                // Build local key
                const localKey = getLocalKey(mun, zona, localNum);
                const localDbId = localMap.get(localKey);

                if (!localDbId) {
                    skippedNoLocal++;
                    return;
                }

                let cand = candidateMap.get(candNum);

                // SPECIAL HANDLING FOR PRESIDENTE (CD_CARGO = 1)
                if (cdCargo === '1') {
                    let forcedName = null;
                    let forcedParty = null;

                    // Top 2018 Presidential candidates
                    if (candNum === '17') { forcedName = 'JAIR BOLSONARO'; forcedParty = 'PSL'; }
                    else if (candNum === '13') { forcedName = 'FERNANDO HADDAD'; forcedParty = 'PT'; }
                    else if (candNum === '12') { forcedName = 'CIRO GOMES'; forcedParty = 'PDT'; }
                    else if (candNum === '15') { forcedName = 'GERALDO ALCKMIN'; forcedParty = 'PSDB'; }
                    else if (candNum === '45') { forcedName = 'MARINA SILVA'; forcedParty = 'REDE'; }
                    else if (candNum === '50') { forcedName = 'GUILHERME BOULOS'; forcedParty = 'PSOL'; }
                    else if (candNum === '30') { forcedName = 'JOÃO AMOEDO'; forcedParty = 'NOVO'; }
                    else if (candNum === '19') { forcedName = 'CABO DACIOLO'; forcedParty = 'PATRIOTA'; }
                    else if (candNum === '27') { forcedName = 'HENRIQUE MEIRELLES'; forcedParty = 'MDB'; }
                    else if (candNum === '51') { forcedName = 'JOSÉ MARIA EYMAEL'; forcedParty = 'DC'; }
                    else if (candNum === '16') { forcedName = 'VERA LUCIA'; forcedParty = 'PSTU'; }
                    else if (candNum === '62') { forcedName = 'JOÃO GOULART FILHO'; forcedParty = 'PPL'; }
                    else if (candNum === '21') { forcedName = 'ALVARO DIAS'; forcedParty = 'PODE'; }
                    else if (candNum === '95') { forcedName = 'BRANCO'; forcedParty = 'N/A'; }
                    else if (candNum === '96') { forcedName = 'NULO'; forcedParty = 'N/A'; }

                    if (forcedName) {
                        cand = { nome: forcedName, partido: forcedParty, cargo: 'PRESIDENTE', numero: candNum };
                    } else if (!cand) {
                        cand = { nome: `PRESIDENTE (${candNum})`, partido: 'N/A', cargo: 'PRESIDENTE', numero: candNum };
                    } else {
                        cand = { ...cand, cargo: 'PRESIDENTE' };
                    }
                }

                const nome = cand ? cand.nome : (candNum == '95' ? 'BRANCO' : (candNum == '96' ? 'NULO' : 'OUTROS'));
                const partido = cand ? cand.partido : 'N/A';
                const cargo = cand ? cand.cargo : row['DS_CARGO'] || 'DESCONHECIDO';

                const votes = parseInt(row['QT_VOTOS']);

                // Aggregate Key: LocalDBID + CandNum + Cargo
                const aggKey = `${localDbId}|${candNum}|${cargo}`;

                if (!votesMap.has(aggKey)) {
                    votesMap.set(aggKey, {
                        local_id: localDbId,
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
                console.log(`\n${fileLabel} Concluído. Linhas processadas: ${processed}, Sem local: ${skippedNoLocal}`);
                resolve();
            })
            .on('error', reject);
    });
}

async function importData2018() {
    const client = await pool.connect();
    console.log('======================================');
    console.log('IMPORTAÇÃO DE DADOS 2018');
    console.log('======================================');

    try {
        // 0. Load existing locals from database (from 2022 import)
        await loadExistingLocals();

        // 1. Process Candidatos 2018
        console.log('\nLendo Candidatos 2018...');
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
        console.log(`Candidatos 2018 carregados: ${candidateMap.size}`);

        // 2. Process Votes from RJ file (State Elections)
        console.log('\n--- ETAPA 1: Processando Votos ESTADUAIS (RJ) 2018 ---');
        await processVotingFile(PATH_VOTACAO_RJ, 'RJ_VOTES_2018', (row) => row['CD_CARGO'] !== '1');

        // 3. Process Votes from BR file (Presidential - filter RJ only)
        console.log('\n--- ETAPA 2: Processando Votos PRESIDENCIAIS (BR) 2018 ---');
        await processVotingFile(PATH_VOTACAO_BR, 'BR_PRESIDENT_VOTES_2018', (row) => {
            return row['SG_UF'] === 'RJ' && row['CD_CARGO'] === '1';
        });

        // 4. Bulk Insert Votes with ano = 2018
        console.log(`\nInserindo ${votesMap.size} registros agregados para 2018...`);
        const allVotes = Array.from(votesMap.values());
        const CHUNK_SIZE = 5000;

        for (let i = 0; i < allVotes.length; i += CHUNK_SIZE) {
            const chunk = allVotes.slice(i, i + CHUNK_SIZE);
            const values = [];
            const placeholders = [];

            chunk.forEach((v, idx) => {
                const base = idx * 7;
                placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
                values.push(2018, v.cargo, v.candidato_nome, v.candidato_numero, v.partido_sigla, v.local_id, v.total_votos);
            });

            const query = `
            INSERT INTO votos_agregados (ano, cargo, candidato_nome, candidato_numero, partido_sigla, local_id, total_votos)
            VALUES ${placeholders.join(',')}
        `;

            await client.query(query, values);
            process.stdout.write(`\rVotos 2018 salvos: ${Math.min(i + CHUNK_SIZE, allVotes.length)}`);
        }

        console.log('\n======================================');
        console.log('IMPORTAÇÃO 2018 COMPLETA COM SUCESSO!');
        console.log('======================================');

    } catch (err) {
        console.error('Erro fatal:', err);
    } finally {
        client.release();
        process.exit();
    }
}

importData2018();
