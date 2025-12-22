const pool = require('./src/config/database');

async function check() {
    const client = await pool.connect();
    try {
        console.log('--- Checking for Duplicate Candidates (Same Number/Ano/Cargo) ---');
        const res1 = await client.query(`
            SELECT ano, candidato_numero, cargo, COUNT(*) 
            FROM candidatos 
            GROUP BY ano, candidato_numero, cargo 
            HAVING COUNT(*) > 1
        `);
        if (res1.rowCount > 0) {
            console.log('Creates Duplicates in Join:', res1.rows);
        } else {
            console.log('No duplicates found in candidates metadata table.');
        }

        console.log('\n--- Checking for Duplicate Aggregated Votes Keys ---');
        // This is expensive, so checking a sample or specific known bad cases
        // Let's check generally if we have multiple entries for same local/cand/cargo
        const res2 = await client.query(`
            SELECT ano, local_id, candidato_numero, cargo, COUNT(*)
            FROM votos_agregados
            GROUP BY ano, local_id, candidato_numero, cargo
            HAVING COUNT(*) > 1
            LIMIT 10
        `);
        if (res2.rowCount > 0) {
            console.log('Found duplicates in votos_agregados:', res2.rows);
        } else {
            console.log('No partial duplicates in votos_agregados sample.');
        }

        console.log('\n--- Checking "Top Candidates" Query Logic ---');
        // Simulate the query used in stats service to see raw rows
        const res3 = await client.query(`
            SELECT 
                v.candidato_nome,
                v.candidato_numero,
                v.partido_sigla,
                c.sq_candidato,
                UPPER(v.cargo) as v_cargo,
                c.cargo as c_cargo
            FROM votos_agregados v
            JOIN locais_votacao l ON v.local_id = l.id
            LEFT JOIN candidatos c ON c.ano = v.ano AND c.candidato_numero = v.candidato_numero
            WHERE v.ano = 2022 AND v.candidato_numero = '22' AND v.cargo = 'PRESIDENTE'
            LIMIT 5
        `);
        console.log('Sample Join Result (Bolsonaro 22):');
        res3.rows.forEach(r => {
            console.log(`Cand: ${r.candidato_nome} | Num: ${r.candidato_numero} | Cargo Voto: ${r.v_cargo} | Cargo Meta: ${r.c_cargo} | SQ: ${r.sq_candidato}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
check();
