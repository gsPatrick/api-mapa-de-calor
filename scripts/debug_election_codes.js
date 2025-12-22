const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const PATH_VOTACAO = 'd:/projetorj/votacao_secao_2022_RJ/votacao_secao_2022_RJ.csv';

console.log('Scanning distinct CD_ELEICAO and SG_UE codes...');

const elecciones = new Set();
const ues = new Set();
let count = 0;

fs.createReadStream(PATH_VOTACAO)
    .pipe(iconv.decodeStream('ISO-8859-1'))
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
        const ele = row['CD_ELEICAO'];
        const ue = row['SG_UE'];

        if (ele && !elecciones.has(ele)) {
            elecciones.add(ele);
            console.log(`Found NEW CD_ELEICAO: '${ele}'`);
        }
        if (ue && !ues.has(ue)) {
            ues.add(ue);
            console.log(`Found NEW SG_UE: '${ue}' (Row ${count})`);
        }

        count++;
        if (count >= 1000000) {
            console.log('Scanned 1M rows.');
            console.log('Distinct CD_ELEICAO:', Array.from(elecciones));
            console.log('Distinct SG_UE:', Array.from(ues));
            process.exit();
        }
    });
