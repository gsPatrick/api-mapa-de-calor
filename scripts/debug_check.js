const pool = require('../src/config/database');
// axios removed
// Actually, let's just use pg to check DB first, then manual fetch if needed.

async function debug() {
    try {
        console.log('--- Database Check ---');
        const resLocais = await pool.query('SELECT COUNT(*) FROM locais_votacao');
        console.log('Total Locais:', resLocais.rows[0].count);

        const resVotos = await pool.query('SELECT COUNT(*) FROM votos_agregados');
        console.log('Total Votos Agregados:', resVotos.rows[0].count);

        // Check Sample Data
        const sample = await pool.query('SELECT * FROM votos_agregados LIMIT 1');
        if (sample.rows.length > 0) {
            console.log('Sample Voto:', sample.rows[0]);

            // Try to simulate map query for this candidate
            const candNum = sample.rows[0].candidato_numero;
            const cargo = sample.rows[0].cargo;
            console.log(`\n--- Simulating Map Query for Cand ${candNum} (${cargo}) ---`);

            const query = `
                WITH local_totals AS (
                    SELECT local_id, SUM(total_votos) as total_cargo
                    FROM votos_agregados
                    WHERE cargo = $1
                    GROUP BY local_id
                )
                SELECT 
                    l.id,
                    l.nome_local,
                    l.latitude, 
                    l.longitude, 
                    v.total_votos,
                    totals.total_cargo
                FROM votos_agregados v
                JOIN locais_votacao l ON v.local_id = l.id
                JOIN local_totals totals ON v.local_id = totals.local_id
                WHERE v.cargo = $1 AND v.candidato_numero = $2
                LIMIT 5
            `;
            const mapRes = await pool.query(query, [cargo, candNum]);
            console.log('Map Query Result Sample:', mapRes.rows);

            if (mapRes.rows.length === 0) {
                console.log('WARNING: Map query returned 0 rows despite existing votes. Check Join conditions.');
            }
        } else {
            console.log('WARNING: No votes found in table.');
        }

    } catch (err) {
        console.error('Debug Error:', err);
    } finally {
        pool.end();
    }
}

debug();
