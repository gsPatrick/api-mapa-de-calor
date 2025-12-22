const pool = require('../src/config/database');

async function debugQuery() {
    const cargo = 'PRESIDENTE'; // Try UPPERCASE
    const numero = '22';        // Try String

    console.log(`Running Map Query for Cargo: '${cargo}', Numero: '${numero}'`);

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
        LIMIT 5;
    `;

    try {
        const res = await pool.query(query, [cargo, numero]);
        console.log(`Query returned ${res.rowCount} rows.`);
        if (res.rowCount > 0) {
            console.log('Sample Row:', res.rows[0]);
        } else {
            console.log('NO DATA FOUND. Checking exact matches in DB...');
            // Diagnostic
            const checkCargo = await pool.query("SELECT DISTINCT cargo FROM votos_agregados LIMIT 5");
            console.log('Available Cargos:', checkCargo.rows.map(r => r.cargo));

            const checkCand = await pool.query("SELECT DISTINCT candidato_numero FROM votos_agregados WHERE cargo = 'PRESIDENTE' LIMIT 5");
            console.log('Available Candidates for PRESIDENTE:', checkCand.rows.map(r => r.candidato_numero));
        }

        // Output results to file for user
        const fs = require('fs');
        fs.writeFileSync('d:/projetorj/debug_map_result.txt', JSON.stringify(res.rows, null, 2));
        console.log('Result saved to debug_map_result.txt');

    } catch (err) {
        console.error('Query Error:', err);
    } finally {
        pool.end();
    }
}

debugQuery();
