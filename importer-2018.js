/**
 * Importador de Dados Eleitorais 2018 - TSE
 * 
 * Este script importa os dados de 2018 para a tabela votos_agregados
 * 
 * Fluxo:
 * 1. Importa locais de votação do RJ (eleitorado_local_votacao_2018.csv)
 * 2. Importa votos de PRESIDENTE do arquivo BR (filtrado por SG_UF = 'RJ')
 * 3. Importa votos estaduais do arquivo RJ (Governador, Senador, Deputados)
 * 4. Importa candidatos de consulta_cand_2018_BR.csv e consulta_cand_2018_RJ.csv
 * 
 * Uso: node importer-2018.js
 */

const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const pool = require('./src/config/database');

// ========== CONFIGURAÇÃO ==========
const DATA_DIR = '/Users/patricksiqueira/rj/2018';
const FILES = {
    votacao_br: `${DATA_DIR}/votacao_secao_2018_BR/votacao_secao_2018_BR.csv`,
    votacao_rj: `${DATA_DIR}/votacao_secao_2018_RJ/votacao_secao_2018_RJ.csv`,
    locais: `${DATA_DIR}/eleitorado_local_votacao_2018/eleitorado_local_votacao_2018.csv`,
    candidatos_br: `${DATA_DIR}/consulta_cand_2018/consulta_cand_2018_BR.csv`,
    candidatos_rj: `${DATA_DIR}/consulta_cand_2018/consulta_cand_2018_RJ.csv`
};

const ANO = 2018;

// Map de candidatos: chave = `${cargo}_${numero}` -> { nome, partido }
const candidatosMap = new Map();

// Map de locais: chave = `${cd_municipio}_${nr_zona}_${nr_local}` -> { nome, endereco, bairro, lat, lng }
const locaisMap = new Map();

// Agregação de votos por local: chave = `${local_id}_${cargo}_${candidato}` -> votos
const votosAgregados = new Map();

// ========== HELPERS ==========
function createReadStreamLatin1(filepath) {
    return fs.createReadStream(filepath)
        .pipe(iconv.decodeStream('latin1'));
}

function normalizeCargo(cdCargo, dsCargo) {
    const cargoMap = {
        '1': 'PRESIDENTE',
        '2': 'VICE-PRESIDENTE',
        '3': 'GOVERNADOR',
        '4': 'VICE-GOVERNADOR',
        '5': 'SENADOR',
        '6': 'DEPUTADO FEDERAL',
        '7': 'DEPUTADO ESTADUAL',
        '8': '1º SUPLENTE',
        '9': '2º SUPLENTE'
    };
    return cargoMap[cdCargo] || dsCargo?.toUpperCase() || 'DESCONHECIDO';
}

// ========== STEP 1: CARREGAR LOCAIS (RJ) ==========
async function carregarLocais() {
    console.log('\n📍 [1/4] Carregando locais de votação RJ...');

    return new Promise((resolve, reject) => {
        let count = 0;
        let rjCount = 0;

        createReadStreamLatin1(FILES.locais)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;

                // Filtrar apenas RJ
                if (row.SG_UF !== 'RJ') return;

                rjCount++;
                const key = `${row.CD_MUNICIPIO}_${row.NR_ZONA}_${row.NR_LOCAL_VOTACAO}`;

                if (!locaisMap.has(key)) {
                    locaisMap.set(key, {
                        id_tse: `${row.CD_MUNICIPIO}-${row.NR_ZONA}-${row.NR_LOCAL_VOTACAO}`,
                        nome: row.NM_LOCAL_VOTACAO,
                        endereco: row.DS_ENDERECO,
                        bairro: row.NM_BAIRRO,
                        cidade: row.NM_MUNICIPIO,
                        latitude: parseFloat(row.NR_LATITUDE) || null,
                        longitude: parseFloat(row.NR_LONGITUDE) || null,
                        cd_municipio: row.CD_MUNICIPIO,
                        nr_zona: row.NR_ZONA,
                        nr_local: row.NR_LOCAL_VOTACAO
                    });
                }

                if (count % 100000 === 0) {
                    console.log(`   Processadas ${count.toLocaleString()} linhas... (RJ: ${rjCount.toLocaleString()})`);
                }
            })
            .on('end', () => {
                console.log(`   ✅ Total processado: ${count.toLocaleString()} linhas`);
                console.log(`   ✅ Locais RJ únicos: ${locaisMap.size.toLocaleString()}`);
                resolve();
            })
            .on('error', reject);
    });
}

// ========== STEP 2: CARREGAR CANDIDATOS ==========
async function carregarCandidatos() {
    console.log('\n👤 [2/4] Carregando candidatos...');

    // Carregar candidatos BR (Presidente)
    await new Promise((resolve, reject) => {
        let count = 0;

        createReadStreamLatin1(FILES.candidatos_br)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;
                const cargo = normalizeCargo(row.CD_CARGO, row.DS_CARGO);
                const numero = row.NR_CANDIDATO;
                const key = `${cargo}_${numero}`;

                if (!candidatosMap.has(key)) {
                    candidatosMap.set(key, {
                        nome: row.NM_URNA_CANDIDATO || row.NM_CANDIDATO,
                        partido: row.SG_PARTIDO
                    });
                }
            })
            .on('end', () => {
                console.log(`   ✅ Candidatos BR: ${count} processados`);
                resolve();
            })
            .on('error', reject);
    });

    // Carregar candidatos RJ (Estaduais)
    await new Promise((resolve, reject) => {
        let count = 0;

        createReadStreamLatin1(FILES.candidatos_rj)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;
                const cargo = normalizeCargo(row.CD_CARGO, row.DS_CARGO);
                const numero = row.NR_CANDIDATO;
                const key = `${cargo}_${numero}`;

                if (!candidatosMap.has(key)) {
                    candidatosMap.set(key, {
                        nome: row.NM_URNA_CANDIDATO || row.NM_CANDIDATO,
                        partido: row.SG_PARTIDO
                    });
                }
            })
            .on('end', () => {
                console.log(`   ✅ Candidatos RJ: ${count} processados`);
                console.log(`   ✅ Total candidatos únicos: ${candidatosMap.size.toLocaleString()}`);
                resolve();
            })
            .on('error', reject);
    });
}

// ========== STEP 3: PROCESSAR VOTOS ==========
async function processarVotos() {
    console.log('\n🗳️ [3/4] Processando votos...');

    // 3a. Votos de PRESIDENTE (arquivo BR, filtrar RJ)
    console.log('   📊 Processando PRESIDENTE (arquivo BR)...');
    await new Promise((resolve, reject) => {
        let count = 0;
        let votosRJ = 0;
        let skipped = 0;

        createReadStreamLatin1(FILES.votacao_br)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;

                // Filtrar apenas RJ e cargo 1 (Presidente)
                if (row.SG_UF !== 'RJ' || row.CD_CARGO !== '1') {
                    skipped++;
                    return;
                }

                const localKey = `${row.CD_MUNICIPIO}_${row.NR_ZONA}_${row.NR_LOCAL_VOTACAO}`;
                const local = locaisMap.get(localKey);

                if (!local) {
                    skipped++;
                    return;
                }

                const cargo = 'PRESIDENTE';
                const numero = row.NR_VOTAVEL;
                const votos = parseInt(row.QT_VOTOS) || 0;

                const votoKey = `${local.id_tse}_${cargo}_${numero}`;
                const current = votosAgregados.get(votoKey) || {
                    local: local,
                    cargo: cargo,
                    numero: numero,
                    nome: row.NM_VOTAVEL || candidatosMap.get(`${cargo}_${numero}`)?.nome || `${cargo} (${numero})`,
                    partido: candidatosMap.get(`${cargo}_${numero}`)?.partido || 'N/A',
                    votos: 0
                };

                current.votos += votos;
                votosAgregados.set(votoKey, current);
                votosRJ++;

                if (count % 1000000 === 0) {
                    console.log(`      Processadas ${(count / 1000000).toFixed(1)}M linhas... (votos RJ: ${votosRJ.toLocaleString()})`);
                }
            })
            .on('end', () => {
                console.log(`      ✅ PRESIDENTE: ${count.toLocaleString()} linhas, ${votosRJ.toLocaleString()} votos RJ agregados`);
                resolve();
            })
            .on('error', reject);
    });

    // 3b. Votos estaduais (arquivo RJ)
    console.log('   📊 Processando cargos estaduais (arquivo RJ)...');
    await new Promise((resolve, reject) => {
        let count = 0;
        let votosAgregadosCount = 0;
        let skipped = 0;

        createReadStreamLatin1(FILES.votacao_rj)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;

                const localKey = `${row.CD_MUNICIPIO}_${row.NR_ZONA}_${row.NR_LOCAL_VOTACAO}`;
                const local = locaisMap.get(localKey);

                if (!local) {
                    skipped++;
                    return;
                }

                const cargo = normalizeCargo(row.CD_CARGO, row.DS_CARGO);
                const numero = row.NR_VOTAVEL;
                const votos = parseInt(row.QT_VOTOS) || 0;

                // Ignorar cargos que não queremos
                if (!['GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL'].includes(cargo)) {
                    return;
                }

                const votoKey = `${local.id_tse}_${cargo}_${numero}`;
                const current = votosAgregados.get(votoKey) || {
                    local: local,
                    cargo: cargo,
                    numero: numero,
                    nome: row.NM_VOTAVEL || candidatosMap.get(`${cargo}_${numero}`)?.nome || `${cargo} (${numero})`,
                    partido: candidatosMap.get(`${cargo}_${numero}`)?.partido || 'N/A',
                    votos: 0
                };

                current.votos += votos;
                votosAgregados.set(votoKey, current);
                votosAgregadosCount++;

                if (count % 1000000 === 0) {
                    console.log(`      Processadas ${(count / 1000000).toFixed(1)}M linhas...`);
                }
            })
            .on('end', () => {
                console.log(`      ✅ Estaduais: ${count.toLocaleString()} linhas processadas`);
                console.log(`      ✅ Total registros agregados: ${votosAgregados.size.toLocaleString()}`);
                resolve();
            })
            .on('error', reject);
    });
}

// ========== STEP 4: INSERIR NO BANCO ==========
async function inserirNoBanco() {
    console.log('\n💾 [4/4] Inserindo dados no banco de dados...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 4a. Deletar dados de 2018 existentes
        console.log('   🗑️ Removendo dados 2018 existentes...');
        const deleteResult = await client.query('DELETE FROM votos_agregados WHERE ano = $1', [ANO]);
        console.log(`      Removidos ${deleteResult.rowCount} registros antigos`);

        // 4b. Inserir novos votos
        console.log(`   📥 Inserindo ${votosAgregados.size.toLocaleString()} registros...`);

        let inserted = 0;
        let errors = 0;

        for (const [key, voto] of votosAgregados) {
            try {
                // Primeiro, garantir que o local existe
                const localCheck = await client.query(
                    'SELECT id FROM locais_votacao WHERE id_tse = $1',
                    [voto.local.id_tse]
                );

                let localId;

                if (localCheck.rows.length === 0) {
                    // Inserir local
                    const insertLocal = await client.query(`
                        INSERT INTO locais_votacao (id_tse, nome_local, endereco, bairro, cidade, latitude, longitude)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (id_tse) DO UPDATE SET 
                            nome_local = EXCLUDED.nome_local,
                            endereco = EXCLUDED.endereco,
                            bairro = EXCLUDED.bairro
                        RETURNING id
                    `, [
                        voto.local.id_tse,
                        voto.local.nome,
                        voto.local.endereco,
                        voto.local.bairro,
                        voto.local.cidade,
                        voto.local.latitude,
                        voto.local.longitude
                    ]);
                    localId = insertLocal.rows[0].id;
                } else {
                    localId = localCheck.rows[0].id;
                }

                // Inserir voto
                await client.query(`
                    INSERT INTO votos_agregados (local_id, cargo, candidato_numero, candidato_nome, partido_sigla, total_votos, ano)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (ano, cargo, candidato_numero, local_id) DO UPDATE SET
                        total_votos = EXCLUDED.total_votos,
                        candidato_nome = EXCLUDED.candidato_nome,
                        partido_sigla = EXCLUDED.partido_sigla
                `, [
                    localId,
                    voto.cargo,
                    voto.numero,
                    voto.nome,
                    voto.partido,
                    voto.votos,
                    ANO
                ]);

                inserted++;

                if (inserted % 10000 === 0) {
                    console.log(`      Inseridos ${inserted.toLocaleString()} registros...`);
                }
            } catch (err) {
                errors++;
                if (errors <= 5) {
                    console.error(`      ❌ Erro: ${err.message}`);
                }
            }
        }

        await client.query('COMMIT');
        console.log(`   ✅ Inseridos: ${inserted.toLocaleString()} registros`);
        if (errors > 0) console.log(`   ⚠️ Erros: ${errors}`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Erro fatal:', err);
        throw err;
    } finally {
        client.release();
    }
}

// ========== VALIDAÇÃO ==========
async function validar() {
    console.log('\n🔍 Validando importação...');

    // Total de votos por cargo
    const result = await pool.query(`
        SELECT cargo, SUM(total_votos) as total, COUNT(DISTINCT local_id) as locais
        FROM votos_agregados
        WHERE ano = $1
        GROUP BY cargo
        ORDER BY total DESC
    `, [ANO]);

    console.log('\n📊 RESUMO 2018:');
    console.log('─'.repeat(60));
    result.rows.forEach(row => {
        console.log(`   ${row.cargo.padEnd(20)} ${parseInt(row.total).toLocaleString().padStart(15)} votos em ${row.locais} locais`);
    });
    console.log('─'.repeat(60));

    // Total geral
    const totalResult = await pool.query(`
        SELECT SUM(total_votos) as total FROM votos_agregados WHERE ano = $1
    `, [ANO]);
    console.log(`   TOTAL 2018: ${parseInt(totalResult.rows[0].total).toLocaleString()} votos`);
}

// ========== MAIN ==========
async function main() {
    console.log('═'.repeat(60));
    console.log('🗳️  IMPORTADOR DE DADOS ELEITORAIS 2018 - RIO DE JANEIRO');
    console.log('═'.repeat(60));

    const startTime = Date.now();

    try {
        await carregarLocais();
        await carregarCandidatos();
        await processarVotos();
        await inserirNoBanco();
        await validar();

        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log(`\n✅ Importação concluída em ${elapsed} minutos!`);

    } catch (err) {
        console.error('\n❌ Erro fatal:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
