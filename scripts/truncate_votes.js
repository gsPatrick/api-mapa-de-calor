const pool = require('../src/config/database');

async function truncate() {
    try {
        console.log('Truncating votos_agregados...');
        await pool.query('TRUNCATE TABLE votos_agregados RESTART IDENTITY CASCADE');
        console.log('Table truncated.');
    } catch (err) {
        console.error('Error truncating:', err);
    } finally {
        pool.end();
    }
}

truncate();
