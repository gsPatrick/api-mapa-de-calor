const pool = require('./src/config/database');

async function checkData() {
    try {
        console.log('Checking available cargos...');
        const cargos = await pool.query('SELECT DISTINCT cargo FROM votos_agregados');
        console.log('Cargos:', cargos.rows.map(r => r.cargo));

        console.log('\nChecking candidates 22 in ANY cargo...');
        const cand22 = await pool.query('SELECT DISTINCT cargo, candidato_numero FROM votos_agregados WHERE candidato_numero = 22');
        console.log('Candidates with number 22:', cand22.rows);

        const count = await pool.query('SELECT count(*) FROM votos_agregados');
        console.log('\nTotal rows in votos_agregados:', count.rows[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkData();
