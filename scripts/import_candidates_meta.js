const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const pool = require('../src/config/database');

// Paths
const PATH_CONSULTA_2022 = 'd:/projetorj/consulta_cand_2022/consulta_cand_2022_RJ.csv';
const PATH_CONSULTA_2018 = 'd:/projetorj/2018/consulta_cand_2018/consulta_cand_2018_RJ.csv';

// SQL to create table
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS candidatos (
    ano INTEGER NOT NULL,
    sq_candidato VARCHAR(50) NOT NULL,
    candidato_numero VARCHAR(20) NOT NULL,
    candidato_nome VARCHAR(255) NOT NULL,
    partido_sigla VARCHAR(20),
    cargo VARCHAR(50),
    PRIMARY KEY (ano, sq_candidato)
);
CREATE INDEX IF NOT EXISTS idx_candidatos_numero ON candidatos (candidato_numero);
CREATE INDEX IF NOT EXISTS idx_candidatos_ano ON candidatos (ano);
`;

async function processFile(filePath, year) {
    console.log(`\nProcessando candidatos de ${year}...`);
    return new Promise((resolve, reject) => {
        const candidates = new Map(); // Key: SQ_CANDIDATO -> Object

        fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('ISO-8859-1'))
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                const sq = row['SQ_CANDIDATO'];
                const nr = row['NR_CANDIDATO'];
                const nome = row['NM_URNA_CANDIDATO'];
                const partido = row['SG_PARTIDO'];
                const cargo = row['DS_CARGO'];

                // Only active candidates roughly? Or all?
                // Let's take all to be safe so photos work for everyone.

                if (sq && nr) {
                    candidates.set(sq, {
                        ano: year,
                        sq_candidato: sq,
                        candidato_numero: nr,
                        candidato_nome: nome,
                        partido_sigla: partido,
                        cargo: cargo
                    });
                }
            })
            .on('end', async () => {
                console.log(`Lidos ${candidates.size} candidatos de ${year}. Inserindo...`);
                const client = await pool.connect();
                try {
                    const values = Array.from(candidates.values());
                    const CHUNK_SIZE = 1000;

                    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
                        const chunk = values.slice(i, i + CHUNK_SIZE);
                        const params = [];
                        const placeholders = [];

                        chunk.forEach((c, idx) => {
                            const base = idx * 6;
                            placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
                            params.push(c.ano, c.sq_candidato, c.candidato_numero, c.candidato_nome, c.partido_sigla, c.cargo);
                        });

                        const query = `
                            INSERT INTO candidatos (ano, sq_candidato, candidato_numero, candidato_nome, partido_sigla, cargo)
                            VALUES ${placeholders.join(',')}
                            ON CONFLICT (ano, sq_candidato) DO UPDATE 
                            SET candidato_numero = EXCLUDED.candidato_numero,
                                candidato_nome = EXCLUDED.candidato_nome,
                                partido_sigla = EXCLUDED.partido_sigla,
                                cargo = EXCLUDED.cargo;
                        `;

                        await client.query(query, params);
                        process.stdout.write(`\rInseridos: ${Math.min(i + CHUNK_SIZE, values.length)}`);
                    }
                    console.log('\nFinalizado.');
                    resolve();
                } catch (e) {
                    reject(e);
                } finally {
                    client.release();
                }
            })
            .on('error', reject);
    });
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('Criando tabela candidatos...');
        await client.query(CREATE_TABLE_SQL);
    } catch (e) {
        console.error('Erro ao criar tabela:', e);
        process.exit(1);
    } finally {
        client.release();
    }

    try {
        await processFile(PATH_CONSULTA_2022, 2022);
        await processFile(PATH_CONSULTA_2018, 2018);
        console.log('FIM.');
        process.exit(0);
    } catch (e) {
        console.error('Erro no processamento:', e);
        process.exit(1);
    }
}

run();
