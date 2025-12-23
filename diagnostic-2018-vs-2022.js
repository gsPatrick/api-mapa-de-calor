/**
 * Diagnóstico Completo - API 2018 vs 2022
 * 
 * Verifica se todos os endpoints retornam dados consistentes
 * para ambos os anos.
 * 
 * Uso: node diagnostic-2018-vs-2022.js
 */

const fs = require('fs');

const API_BASE = 'https://geral-mapadecalorapi.r954jc.easypanel.host';

const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { passed: 0, failed: 0, warnings: 0 }
};

async function testEndpoint(name, url, validator) {
    console.log(`\n🔍 Testando: ${name}`);
    console.log(`   URL: ${url}`);

    try {
        const res = await fetch(url);
        const status = res.status;

        if (!res.ok) {
            const error = await res.text();
            results.tests.push({ name, url, status, error, result: 'FAILED' });
            results.summary.failed++;
            console.log(`   ❌ FAILED: HTTP ${status} - ${error.substring(0, 100)}`);
            return null;
        }

        const data = await res.json();
        const validation = validator ? validator(data) : { ok: true, message: 'OK' };

        if (validation.ok) {
            results.tests.push({ name, url, status, result: 'PASSED', details: validation.message, sample: data });
            results.summary.passed++;
            console.log(`   ✅ PASSED: ${validation.message}`);
        } else if (validation.warning) {
            results.tests.push({ name, url, status, result: 'WARNING', details: validation.message, sample: data });
            results.summary.warnings++;
            console.log(`   ⚠️ WARNING: ${validation.message}`);
        } else {
            results.tests.push({ name, url, status, result: 'FAILED', details: validation.message, sample: data });
            results.summary.failed++;
            console.log(`   ❌ FAILED: ${validation.message}`);
        }

        return data;
    } catch (err) {
        results.tests.push({ name, url, error: err.message, result: 'FAILED' });
        results.summary.failed++;
        console.log(`   ❌ EXCEPTION: ${err.message}`);
        return null;
    }
}

async function run() {
    console.log('═'.repeat(70));
    console.log('🔬 DIAGNÓSTICO COMPLETO: API 2018 vs 2022');
    console.log('═'.repeat(70));

    // ============ TESTE 1: Stats Gerais ============
    const stats2022 = await testEndpoint(
        'Stats 2022 - PRESIDENTE',
        `${API_BASE}/api/stats?ano=2022&cargo=PRESIDENTE`,
        (data) => {
            if (!data.summary) return { ok: false, message: 'Sem campo summary' };
            if (data.summary.total_votos === 0) return { ok: false, message: 'total_votos = 0' };
            return { ok: true, message: `total_votos: ${data.summary.total_votos.toLocaleString()}, locais: ${data.summary.total_locais}` };
        }
    );

    const stats2018 = await testEndpoint(
        'Stats 2018 - PRESIDENTE',
        `${API_BASE}/api/stats?ano=2018&cargo=PRESIDENTE`,
        (data) => {
            if (!data.summary) return { ok: false, message: 'Sem campo summary' };
            if (data.summary.total_votos === 0) return { ok: false, message: 'total_votos = 0 ⚠️ DADOS 2018 NÃO IMPORTADOS?' };
            return { ok: true, message: `total_votos: ${data.summary.total_votos.toLocaleString()}, locais: ${data.summary.total_locais}` };
        }
    );

    // ============ TESTE 2: Mapa (Heatmap) ============
    const mapa2022 = await testEndpoint(
        'Mapa 2022 - PRESIDENTE + Candidato 22',
        `${API_BASE}/api/mapa?ano=2022&cargo=PRESIDENTE&candidato=22`,
        (data) => {
            if (!Array.isArray(data)) return { ok: false, message: 'Resposta não é array' };
            if (data.length === 0) return { ok: false, message: 'Array vazio' };
            const totalVotos = data.reduce((acc, p) => acc + (p.votos || 0), 0);
            const comVotos = data.filter(p => p.votos > 0).length;
            if (totalVotos === 0) return { warning: true, message: `0 votos (${data.length} pontos) - Candidato não existe?` };
            return { ok: true, message: `${data.length} pontos, ${comVotos} com votos, total: ${totalVotos.toLocaleString()}` };
        }
    );

    const mapa2018 = await testEndpoint(
        'Mapa 2018 - PRESIDENTE + Candidato 17',
        `${API_BASE}/api/mapa?ano=2018&cargo=PRESIDENTE&candidato=17`,
        (data) => {
            if (!Array.isArray(data)) return { ok: false, message: 'Resposta não é array' };
            if (data.length === 0) return { ok: false, message: 'Array vazio' };
            const totalVotos = data.reduce((acc, p) => acc + (p.votos || 0), 0);
            const comVotos = data.filter(p => p.votos > 0).length;
            if (totalVotos === 0) return { warning: true, message: `0 votos (${data.length} pontos) - Candidato 17 não existe em 2018?` };
            return { ok: true, message: `${data.length} pontos, ${comVotos} com votos, total: ${totalVotos.toLocaleString()}` };
        }
    );

    // ============ TESTE 3: Escola Individual ============
    const escola2022 = await testEndpoint(
        'Escola ID=1 - 2022 PRESIDENTE',
        `${API_BASE}/api/escolas/1?ano=2022&cargo=PRESIDENTE`,
        (data) => {
            if (!data.ranking || !Array.isArray(data.ranking)) return { ok: false, message: 'Sem campo ranking' };
            if (data.ranking.length === 0) return { ok: false, message: 'Ranking vazio' };
            const total = data.ranking.reduce((acc, r) => acc + parseInt(r.total_votos || 0), 0);
            return { ok: true, message: `${data.ranking.length} candidatos, total: ${total.toLocaleString()} votos` };
        }
    );

    const escola2018 = await testEndpoint(
        'Escola ID=1 - 2018 PRESIDENTE',
        `${API_BASE}/api/escolas/1?ano=2018&cargo=PRESIDENTE`,
        (data) => {
            if (!data.ranking || !Array.isArray(data.ranking)) return { ok: false, message: 'Sem campo ranking' };
            if (data.ranking.length === 0) return { warning: true, message: 'Ranking vazio - escola pode não ter dados 2018' };
            const total = data.ranking.reduce((acc, r) => acc + parseInt(r.total_votos || 0), 0);
            return { ok: true, message: `${data.ranking.length} candidatos, total: ${total.toLocaleString()} votos` };
        }
    );

    // ============ TESTE 4: Filtros ============
    await testEndpoint(
        'Filtros Candidatos 2022 PRESIDENTE',
        `${API_BASE}/api/filtros?ano=2022&cargo=PRESIDENTE`,
        (data) => {
            if (!Array.isArray(data)) return { ok: false, message: 'Resposta não é array' };
            if (data.length === 0) return { ok: false, message: 'Lista vazia' };
            return { ok: true, message: `${data.length} candidatos` };
        }
    );

    await testEndpoint(
        'Filtros Candidatos 2018 PRESIDENTE',
        `${API_BASE}/api/filtros?ano=2018&cargo=PRESIDENTE`,
        (data) => {
            if (!Array.isArray(data)) return { ok: false, message: 'Resposta não é array' };
            if (data.length === 0) return { warning: true, message: 'Lista vazia - dados 2018 importados?' };
            return { ok: true, message: `${data.length} candidatos` };
        }
    );

    // ============ TESTE 5: Intelligence ============
    await testEndpoint(
        'Intelligence Resumo 2022',
        `${API_BASE}/api/intelligence/resumo-executivo?candidato=22&cargo=PRESIDENTE&ano=2022`,
        (data) => {
            if (!data.metricas) return { ok: false, message: 'Sem campo metricas' };
            return { ok: true, message: `${data.metricas.length} métricas` };
        }
    );

    await testEndpoint(
        'Intelligence Resumo 2018',
        `${API_BASE}/api/intelligence/resumo-executivo?candidato=17&cargo=PRESIDENTE&ano=2018`,
        (data) => {
            if (!data.metricas) return { ok: false, message: 'Sem campo metricas' };
            const totalVotos = data.resumo?.totalVotos || 0;
            if (totalVotos === 0) return { warning: true, message: 'totalVotos = 0' };
            return { ok: true, message: `${data.metricas.length} métricas, total: ${totalVotos.toLocaleString()}` };
        }
    );

    // ============ TESTE 6: Cargos disponíveis ============
    await testEndpoint(
        'Cargos Disponíveis',
        `${API_BASE}/api/filtros/cargos`,
        (data) => {
            if (!Array.isArray(data)) return { ok: false, message: 'Resposta não é array' };
            const hasPresidente = data.includes('PRESIDENTE');
            const hasGovernador = data.includes('GOVERNADOR');
            if (!hasPresidente) return { ok: false, message: 'Falta PRESIDENTE' };
            return { ok: true, message: `${data.length} cargos: ${data.slice(0, 5).join(', ')}...` };
        }
    );

    // ============ RESUMO ============
    console.log('\n' + '═'.repeat(70));
    console.log('📊 RESUMO DO DIAGNÓSTICO');
    console.log('═'.repeat(70));
    console.log(`   ✅ PASSED:   ${results.summary.passed}`);
    console.log(`   ⚠️ WARNINGS: ${results.summary.warnings}`);
    console.log(`   ❌ FAILED:   ${results.summary.failed}`);
    console.log('═'.repeat(70));

    // Salvar resultados
    const outputPath = './diagnostic-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Resultados salvos em: ${outputPath}`);

    // Salvar resumo em TXT
    const txtPath = './diagnostic-summary.txt';
    let txtContent = `DIAGNÓSTICO API - ${results.timestamp}\n${'='.repeat(50)}\n\n`;
    txtContent += `RESUMO: ${results.summary.passed} OK, ${results.summary.warnings} WARN, ${results.summary.failed} FAIL\n\n`;

    for (const test of results.tests) {
        txtContent += `[${test.result}] ${test.name}\n`;
        txtContent += `   URL: ${test.url}\n`;
        txtContent += `   ${test.details || test.error || 'N/A'}\n\n`;
    }

    fs.writeFileSync(txtPath, txtContent);
    console.log(`📄 Resumo em texto: ${txtPath}`);
}

run().catch(console.error);
