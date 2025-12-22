const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function verify() {
    let output = '';
    const log = (msg) => { console.log(msg); output += msg + '\n'; };

    try {
        log('--- VERIFICATION START ---');
        log('Checking for Cargo: PRESIDENTE');

        const countRes = await pool.query("SELECT COUNT(*) FROM votos_agregados WHERE cargo = 'PRESIDENTE'");
        log(`Total Presidential Records: ${countRes.rows[0].count}`);

        log('\nChecking Candidate 22 (Jair Bolsonaro):');
        const bolsonaro = await pool.query("SELECT SUM(total_votos) as votos FROM votos_agregados WHERE cargo = 'PRESIDENTE' AND candidato_numero = '22'");
        log(`Total Votes for 22: ${bolsonaro.rows[0].votos}`);

        log('\nChecking Candidate 13 (Lula):');
        const lula = await pool.query("SELECT SUM(total_votos) as votos FROM votos_agregados WHERE cargo = 'PRESIDENTE' AND candidato_numero = '13'");
        log(`Total Votes for 13: ${lula.rows[0].votos}`);

        log('\nSample Records (Top 5 for 22):');
        const sample = await pool.query("SELECT * FROM votos_agregados WHERE cargo = 'PRESIDENTE' AND candidato_numero = '22' LIMIT 5");
        sample.rows.forEach(r => {
            log(JSON.stringify(r));
        });

        const outputPath = path.join(__dirname, '../verification_response.txt');
        fs.writeFileSync(outputPath, output);
        log(`\nResponse saved to: ${outputPath}`);

    } catch (err) {
        log(`ERROR: ${err.message}`);
    } finally {
        pool.end();
    }
}

verify();
