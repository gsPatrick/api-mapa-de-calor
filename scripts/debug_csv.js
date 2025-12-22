const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const PATH_VOTACAO = 'd:/projetorj/votacao_secao_2022_RJ/votacao_secao_2022_RJ.csv';

console.log('Reading first 5 rows...');

fs.createReadStream(PATH_VOTACAO)
    .pipe(iconv.decodeStream('ISO-8859-1'))
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        console.log('Row Keys:', Object.keys(row));
        console.log('Row Values:', row);
        console.log('CD_CARGO value:', row['CD_CARGO']);
        console.log('Type of CD_CARGO:', typeof row['CD_CARGO']);
        process.exit();
    });
