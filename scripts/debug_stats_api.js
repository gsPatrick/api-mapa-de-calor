const http = require('http');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function run() {
    console.log("--- Testing without params ---");
    const resNoParams = await get('http://localhost:3001/api/stats');
    console.log(resNoParams);

    console.log("\n--- Testing with cargo=PRESIDENTE ---");
    const resValid = await get('http://localhost:3001/api/stats?cargo=PRESIDENTE');
    console.log(resValid);
}

run();
