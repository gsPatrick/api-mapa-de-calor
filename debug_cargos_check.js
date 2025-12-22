const pool = require('./src/config/database');

async function check() {
    const client = await pool.connect();
    try {
        console.log('--- Votos Agregados Cargos ---');
        const res1 = await client.query('SELECT DISTINCT cargo FROM votos_agregados');
        res1.rows.forEach(r => console.log(`"${r.cargo}"`));

        console.log('\n--- Candidatos Cargos ---');
        const res2 = await client.query('SELECT DISTINCT cargo FROM candidatos');
        res2.rows.forEach(r => console.log(`"${r.cargo}"`));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
check();
