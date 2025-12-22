/**
 * Script de teste para verificar responses da API
 * Execute: node test-api-responses.js
 */

const BASE = 'https://geral-mapadecalorapi.r954jc.easypanel.host';

async function testAPIResponses() {
    console.log('=== TESTE DE RESPONSES DA API ===\n');

    // 1. Teste /api/mapa
    console.log('1. GET /api/mapa?cargo=PRESIDENTE&numero=22&ano=2022');
    try {
        const res = await fetch(`${BASE}/api/mapa?cargo=PRESIDENTE&numero=22&ano=2022`);
        const data = await res.json();
        console.log('Response sample (first 2 items):');
        console.log(JSON.stringify(data.slice(0, 2), null, 2));
        console.log(`Total items: ${data.length}\n`);
    } catch (e) { console.error(e.message); }

    // 2. Teste /api/stats
    console.log('2. GET /api/stats?cargo=PRESIDENTE&ano=2022');
    try {
        const res = await fetch(`${BASE}/api/stats?cargo=PRESIDENTE&ano=2022`);
        const data = await res.json();
        console.log('Response:');
        console.log(JSON.stringify(data, null, 2));
        console.log();
    } catch (e) { console.error(e.message); }

    // 3. Teste /api/stats/crescimento
    console.log('3. GET /api/stats/crescimento?candidato=22&cargo=PRESIDENTE');
    try {
        const res = await fetch(`${BASE}/api/stats/crescimento?candidato=22&cargo=PRESIDENTE`);
        const data = await res.json();
        console.log('Response:');
        console.log(JSON.stringify(data, null, 2));
        console.log();
    } catch (e) { console.error(e.message); }

    // 4. Teste /api/escolas/{id}
    console.log('4. GET /api/escolas/1?cargo=PRESIDENTE&ano=2022');
    try {
        const res = await fetch(`${BASE}/api/escolas/1?cargo=PRESIDENTE&ano=2022`);
        const data = await res.json();
        console.log('Response:');
        console.log(JSON.stringify(data, null, 2));
        console.log();
    } catch (e) { console.error(e.message); }

    // 5. Teste /api/filtros com cargo
    console.log('5. GET /api/filtros?ano=2022&cargo=DEPUTADO%20FEDERAL');
    try {
        const res = await fetch(`${BASE}/api/filtros?ano=2022&cargo=DEPUTADO%20FEDERAL`);
        const data = await res.json();
        console.log('Response sample (first 3 items):');
        console.log(JSON.stringify(data.slice(0, 3), null, 2));
        console.log(`Total items: ${data.length}\n`);
    } catch (e) { console.error(e.message); }

    // 6. Teste /api/filtros/bairros
    console.log('6. GET /api/filtros/bairros');
    try {
        const res = await fetch(`${BASE}/api/filtros/bairros`);
        const data = await res.json();
        console.log('Response sample (first 5 items):');
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
        console.log(`Total items: ${data.length}\n`);
    } catch (e) { console.error(e.message); }

    // 7. Teste /api/filtros/partidos
    console.log('7. GET /api/filtros/partidos?ano=2022');
    try {
        const res = await fetch(`${BASE}/api/filtros/partidos?ano=2022`);
        const data = await res.json();
        console.log('Response sample (first 5 items):');
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
        console.log(`Total items: ${data.length}\n`);
    } catch (e) { console.error(e.message); }

    console.log('=== FIM DOS TESTES ===');
}

testAPIResponses();
