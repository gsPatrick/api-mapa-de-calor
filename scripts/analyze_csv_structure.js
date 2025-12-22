const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const PATH_VOTACAO = 'd:/projetorj/votacao_secao_2022_RJ/votacao_secao_2022_RJ.csv';

console.log('--- STARTING FULL CSV ANALYSIS ---');
console.log('Target: Extract DISTINCT (CD_ELEICAO, CD_CARGO, SG_UE)');

const stats = new Map(); // Key: "ELE|CARGO|UE" -> Count

let count = 0;
const start = Date.now();

fs.createReadStream(PATH_VOTACAO)
    .pipe(iconv.decodeStream('ISO-8859-1'))
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        const ele = row['CD_ELEICAO'];
        const cargo = row['CD_CARGO'];
        const ue = row['SG_UE'];

        const key = `${ele}|${cargo}|${ue}`;

        if (stats.has(key)) {
            stats.set(key, stats.get(key) + 1);
        } else {
            stats.set(key, 1);
            // Log new discoveries immediately
            console.log(`[NEW FOUND] Ele: ${ele}, Cargo: ${cargo}, UE: ${ue} (at row ${count})`);
        }

        count++;
        if (count % 1000000 === 0) {
            console.log(`Processed ${count / 1000000}M rows...`);
        }
    })
    .on('end', () => {
        console.log('\n--- ANALYSIS COMPLETE ---');
        console.log(`Total Rows: ${count}`);
        console.log(`Duration: ${(Date.now() - start) / 1000}s`);
        console.log('\nDISTINCT COMBINATIONS:');

        for (const [key, val] of stats.entries()) {
            const [ele, cargo, ue] = key.split('|');
            console.log(`[CD_ELEICAO: ${ele}] [CD_CARGO: ${cargo}] [SG_UE: ${ue}] -> Count: ${val}`);
        }
    })
    .on('error', (err) => {
        console.error('Stream Error:', err);
    });
