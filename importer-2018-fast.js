/**
 * Importador de Dados Eleitorais 2018 - TSE (VERSÃO RÁPIDA)
 * 
 * Usa BATCH INSERTS para velocidade máxima
 * 
 * Uso: node importer-2018-fast.js
 */

const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const pool = require('./src/config/database');

const DATA_DIR = '/Users/patricksiqueira/rj/2018';
const FILES = {
    votacao_br: `${DATA_DIR}/votacao_secao_2018_BR/votacao_secao_2018_BR.csv`,
    votacao_rj: `${DATA_DIR}/votacao_secao_2018_RJ/votacao_secao_2018_RJ.csv`,
    locais: `${DATA_DIR}/eleitorado_local_votacao_2018/eleitorado_local_votacao_2018.csv`,
    candidatos_br: `${DATA_DIR}/consulta_cand_2018/consulta_cand_2018_BR.csv`,
    candidatos_rj: `${DATA_DIR}/consulta_cand_2018/consulta_cand_2018_RJ.csv`
};

const ANO = 2018;
const BATCH_SIZE = 500;

const candidatosMap = new Map();
const locaisMap = new Map();
const locaisIdMap = new Map(); // id_tse -> db_id
const votosAgregados = new Map();

function createReadStreamLatin1(filepath) {
    return fs.createReadStream(filepath).pipe(iconv.decodeStream('latin1'));
}

function normalizeCargo(cdCargo) {
    const map = { '1': 'PRESIDENTE', '3': 'GOVERNADOR', '5': 'SENADOR', '6': 'DEPUTADO FEDERAL', '7': 'DEPUTADO ESTADUAL' };
    return map[cdCargo] || null;
}

// STEP 1: Carregar locais RJ
async function carregarLocais() {
    console.log('\n📍 [1/5] Carregando locais de votação RJ...');

    return new Promise((resolve, reject) => {
        let count = 0, rjCount = 0;

        createReadStreamLatin1(FILES.locais)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;
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
                        longitude: parseFloat(row.NR_LONGITUDE) || null
                    });
                }
                if (count % 200000 === 0) console.log(`   ${(count / 1000000).toFixed(1)}M linhas...`);
            })
            .on('end', () => {
                console.log(`   ✅ ${locaisMap.size.toLocaleString()} locais RJ`);
                resolve();
            })
            .on('error', reject);
    });
}

// STEP 2: Sincronizar locais com banco
async function sincronizarLocais() {
    console.log('\n🏫 [2/5] Sincronizando locais com banco...');

    const client = await pool.connect();
    try {
        // Buscar locais existentes
        const existing = await client.query('SELECT id, id_tse FROM locais_votacao');
        existing.rows.forEach(r => locaisIdMap.set(r.id_tse, r.id));
        console.log(`   Existentes: ${existing.rows.length}`);

        // Inserir novos
        let inserted = 0;
        for (const [key, local] of locaisMap) {
            if (!locaisIdMap.has(local.id_tse)) {
                const res = await client.query(`
                    INSERT INTO locais_votacao (id_tse, nome_local, endereco, bairro, cidade, latitude, longitude)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id_tse) DO UPDATE SET nome_local = EXCLUDED.nome_local
                    RETURNING id
                `, [local.id_tse, local.nome, local.endereco, local.bairro, local.cidade, local.latitude, local.longitude]);
                locaisIdMap.set(local.id_tse, res.rows[0].id);
                inserted++;
            }
        }
        console.log(`   ✅ ${inserted} novos locais inseridos`);
    } finally {
        client.release();
    }
}

// STEP 3: Carregar candidatos
async function carregarCandidatos() {
    console.log('\n👤 [3/5] Carregando candidatos...');

    for (const file of [FILES.candidatos_br, FILES.candidatos_rj]) {
        await new Promise((resolve, reject) => {
            createReadStreamLatin1(file)
                .pipe(csv({ separator: ';', quote: '"' }))
                .on('data', (row) => {
                    const cargo = normalizeCargo(row.CD_CARGO);
                    if (!cargo) return;
                    const key = `${cargo}_${row.NR_CANDIDATO}`;
                    if (!candidatosMap.has(key)) {
                        candidatosMap.set(key, {
                            nome: row.NM_URNA_CANDIDATO || row.NM_CANDIDATO,
                            partido: row.SG_PARTIDO
                        });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });
    }
    console.log(`   ✅ ${candidatosMap.size} candidatos`);
}

// STEP 4: Processar votos
async function processarVotos() {
    console.log('\n🗳️ [4/5] Processando votos...');

    // Presidente (arquivo BR, filtrar RJ)
    console.log('   📊 PRESIDENTE (arquivo BR)...');
    await new Promise((resolve, reject) => {
        let count = 0, processed = 0;

        createReadStreamLatin1(FILES.votacao_br)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;
                if (row.SG_UF !== 'RJ' || row.CD_CARGO !== '1') return;

                const localKey = `${row.CD_MUNICIPIO}_${row.NR_ZONA}_${row.NR_LOCAL_VOTACAO}`;
                const local = locaisMap.get(localKey);
                if (!local) return;

                const localId = locaisIdMap.get(local.id_tse);
                if (!localId) return;

                const numero = row.NR_VOTAVEL;
                const votos = parseInt(row.QT_VOTOS) || 0;
                const votoKey = `${localId}_PRESIDENTE_${numero}`;

                const current = votosAgregados.get(votoKey) || {
                    local_id: localId,
                    cargo: 'PRESIDENTE',
                    numero: numero,
                    nome: row.NM_VOTAVEL || candidatosMap.get(`PRESIDENTE_${numero}`)?.nome || `PRESIDENTE (${numero})`,
                    partido: candidatosMap.get(`PRESIDENTE_${numero}`)?.partido || 'N/A',
                    votos: 0
                };
                current.votos += votos;
                votosAgregados.set(votoKey, current);
                processed++;

                if (count % 2000000 === 0) console.log(`      ${(count / 1000000).toFixed(0)}M linhas...`);
            })
            .on('end', () => {
                console.log(`      ✅ ${processed.toLocaleString()} votos RJ`);
                resolve();
            })
            .on('error', reject);
    });

    // Estaduais (arquivo RJ)
    console.log('   📊 ESTADUAIS (arquivo RJ)...');
    await new Promise((resolve, reject) => {
        let count = 0, processed = 0;

        createReadStreamLatin1(FILES.votacao_rj)
            .pipe(csv({ separator: ';', quote: '"' }))
            .on('data', (row) => {
                count++;

                const cargo = normalizeCargo(row.CD_CARGO);
                if (!cargo || cargo === 'PRESIDENTE') return;

                const localKey = `${row.CD_MUNICIPIO}_${row.NR_ZONA}_${row.NR_LOCAL_VOTACAO}`;
                const local = locaisMap.get(localKey);
                if (!local) return;

                const localId = locaisIdMap.get(local.id_tse);
                if (!localId) return;

                const numero = row.NR_VOTAVEL;
                const votos = parseInt(row.QT_VOTOS) || 0;
                const votoKey = `${localId}_${cargo}_${numero}`;

                const current = votosAgregados.get(votoKey) || {
                    local_id: localId,
                    cargo: cargo,
                    numero: numero,
                    nome: row.NM_VOTAVEL || candidatosMap.get(`${cargo}_${numero}`)?.nome || `${cargo} (${numero})`,
                    partido: candidatosMap.get(`${cargo}_${numero}`)?.partido || 'N/A',
                    votos: 0
                };
                current.votos += votos;
                votosAgregados.set(votoKey, current);
                processed++;

                if (count % 2000000 === 0) console.log(`      ${(count / 1000000).toFixed(0)}M linhas...`);
            })
            .on('end', () => {
                console.log(`      ✅ ${processed.toLocaleString()} votos estaduais`);
                console.log(`   ✅ Total agregados: ${votosAgregados.size.toLocaleString()}`);
                resolve();
            })
            .on('error', reject);
    });
}

// STEP 5: Inserir com BATCH
async function inserirBatch() {
    console.log('\n💾 [5/5] Inserindo com BATCH (500 por vez)...');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Deletar 2018 existentes
        await client.query('DELETE FROM votos_agregados WHERE ano = $1', [ANO]);
        console.log('   🗑️ Dados 2018 antigos removidos');

        const votos = Array.from(votosAgregados.values());
        let inserted = 0;

        for (let i = 0; i < votos.length; i += BATCH_SIZE) {
            const batch = votos.slice(i, i + BATCH_SIZE);

            // Construir VALUES
            const values = [];
            const params = [];
            let paramIdx = 1;

            for (const v of batch) {
                values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`);
                params.push(v.local_id, v.cargo, v.numero, v.nome, v.partido, v.votos, ANO);
                paramIdx += 7;
            }

            await client.query(`
                INSERT INTO votos_agregados (local_id, cargo, candidato_numero, candidato_nome, partido_sigla, total_votos, ano)
                VALUES ${values.join(', ')}
                ON CONFLICT (ano, cargo, candidato_numero, local_id) DO UPDATE SET
                    total_votos = EXCLUDED.total_votos
            `, params);

            inserted += batch.length;

            if (inserted % 50000 === 0 || inserted === votos.length) {
                console.log(`   📥 ${inserted.toLocaleString()} / ${votos.length.toLocaleString()} (${((inserted / votos.length) * 100).toFixed(1)}%)`);
            }
        }

        await client.query('COMMIT');
        console.log(`   ✅ ${inserted.toLocaleString()} registros inseridos!`);

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// Validação
async function validar() {
    console.log('\n🔍 Validando...');

    const result = await pool.query(`
        SELECT cargo, SUM(total_votos) as total, COUNT(DISTINCT local_id) as locais
        FROM votos_agregados WHERE ano = $1
        GROUP BY cargo ORDER BY total DESC
    `, [ANO]);

    console.log('\n📊 RESUMO 2018:');
    console.log('─'.repeat(60));
    result.rows.forEach(r => {
        console.log(`   ${r.cargo.padEnd(20)} ${parseInt(r.total).toLocaleString().padStart(15)} votos em ${r.locais} locais`);
    });

    const total = await pool.query('SELECT SUM(total_votos) as t FROM votos_agregados WHERE ano = $1', [ANO]);
    console.log('─'.repeat(60));
    console.log(`   TOTAL: ${parseInt(total.rows[0].t).toLocaleString()} votos`);
}

async function main() {
    console.log('═'.repeat(60));
    console.log('🚀 IMPORTADOR 2018 - VERSÃO RÁPIDA (BATCH INSERTS)');
    console.log('═'.repeat(60));

    const start = Date.now();

    try {
        await carregarLocais();
        await sincronizarLocais();
        await carregarCandidatos();
        await processarVotos();
        await inserirBatch();
        await validar();

        const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
        console.log(`\n✅ Concluído em ${elapsed} minutos!`);
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
