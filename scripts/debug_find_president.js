const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const PATH_VOTACAO = 'd:/projetorj/votacao_secao_2022_RJ/votacao_secao_2022_RJ.csv';

console.log('Searching for CD_CARGO = 1...');

let count = 0;
let found = 0;

fs.createReadStream(PATH_VOTACAO)
    .pipe(iconv.decodeStream('ISO-8859-1'))
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        count++;
        if (row['CD_CARGO'] == '1') {
            console.log('FOUND PRESIDENT ROW:', row);
            found++;
            if (found >= 5) process.exit();
        }
        if (count % 1000000 === 0) console.log(`Scanned ${count} rows...`);
    })
    .on('end', () => {
        console.log(`Scan complete. Found ${found} presidential rows.`);
    });
