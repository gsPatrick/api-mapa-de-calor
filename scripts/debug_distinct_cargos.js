const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const PATH_VOTACAO = 'd:/projetorj/votacao_secao_2022_RJ/votacao_secao_2022_RJ.csv';

console.log('Scanning distinct CD_CARGO codes...');

const cargos = new Set();
let count = 0;

fs.createReadStream(PATH_VOTACAO)
    .pipe(iconv.decodeStream('ISO-8859-1'))
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        const c = row['CD_CARGO'];
        if (c && !cargos.has(c)) {
            cargos.add(c);
            console.log(`Found NEW Cargo Code: '${c}'`);
        }
        count++;
        if (count >= 500000) {
            console.log('Scanned 500k rows. Distinct Cargos:', Array.from(cargos));
            process.exit();
        }
    });
