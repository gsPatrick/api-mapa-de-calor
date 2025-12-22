const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || '69.62.99.122',
    port: process.env.DB_PORT || 1515,
    user: process.env.DB_USER || 'rjbd',
    password: process.env.DB_PASSWORD || 'rjbd',
    database: process.env.DB_NAME || 'rjbd',
    ssl: false
});

async function check() {
    try {
        const res = await pool.query('SELECT ano, count(*) FROM votos_agregados GROUP BY ano ORDER BY ano');
        console.log('Counts per year:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
