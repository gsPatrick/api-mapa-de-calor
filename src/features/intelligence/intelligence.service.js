/**
 * Intelligence Service - BI Analytics Suite
 * 
 * Endpoints para relatórios de inteligência eleitoral
 */

const pool = require('../../config/database');

class IntelligenceService {

    /**
     * Resumo Executivo - Métricas consolidadas do candidato
     */
    async getResumoExecutivo(candidatoNumero, cargo, ano) {
        // Total de votos do candidato
        const votosQuery = await pool.query(`
            SELECT 
                COALESCE(SUM(total_votos), 0) as total_votos,
                COUNT(DISTINCT local_id) as total_locais_candidato
            FROM votos_agregados
            WHERE candidato_numero = $1 AND cargo = $2 AND ano = $3
        `, [candidatoNumero, cargo, ano]);

        const totalVotos = parseInt(votosQuery.rows[0]?.total_votos) || 0;
        const locaisCandidato = parseInt(votosQuery.rows[0]?.total_locais_candidato) || 0;

        // Total geral de votos no estado (para taxa de conversão)
        const totalGeralQuery = await pool.query(`
            SELECT COALESCE(SUM(total_votos), 0) as total_geral
            FROM votos_agregados
            WHERE cargo = $1 AND ano = $2
        `, [cargo, ano]);
        const totalGeral = parseInt(totalGeralQuery.rows[0]?.total_geral) || 1;

        // Municípios alcançados
        const municipiosQuery = await pool.query(`
            SELECT 
                COUNT(DISTINCT lv.cidade) as municipios_candidato,
                (SELECT COUNT(DISTINCT cidade) FROM locais_votacao) as total_municipios
            FROM votos_agregados va
            JOIN locais_votacao lv ON va.local_id = lv.id
            WHERE va.candidato_numero = $1 AND va.cargo = $2 AND va.ano = $3 AND va.total_votos > 0
        `, [candidatoNumero, cargo, ano]);

        const municipiosCandidato = parseInt(municipiosQuery.rows[0]?.municipios_candidato) || 0;
        const totalMunicipios = parseInt(municipiosQuery.rows[0]?.total_municipios) || 92;

        // Zonas eleitorais
        const zonasQuery = await pool.query(`
            SELECT COUNT(DISTINCT SPLIT_PART(lv.id_tse, '-', 2)) as zonas
            FROM votos_agregados va
            JOIN locais_votacao lv ON va.local_id = lv.id
            WHERE va.candidato_numero = $1 AND va.cargo = $2 AND va.ano = $3 AND va.total_votos > 0
        `, [candidatoNumero, cargo, ano]);
        const zonas = parseInt(zonasQuery.rows[0]?.zonas) || 0;

        // Concentração na Capital (RIO DE JANEIRO)
        const capitalQuery = await pool.query(`
            SELECT COALESCE(SUM(va.total_votos), 0) as votos_capital
            FROM votos_agregados va
            JOIN locais_votacao lv ON va.local_id = lv.id
            WHERE va.candidato_numero = $1 AND va.cargo = $2 AND va.ano = $3
            AND UPPER(lv.cidade) = 'RIO DE JANEIRO'
        `, [candidatoNumero, cargo, ano]);
        const votosCapital = parseInt(capitalQuery.rows[0]?.votos_capital) || 0;
        const concentracaoCapital = totalVotos > 0 ? ((votosCapital / totalVotos) * 100).toFixed(1) : '0.0';

        // Potencial de crescimento (comparar com ano anterior se disponível)
        let potencialCrescimento = 0;
        const anoAnterior = ano === 2022 ? 2018 : null;
        if (anoAnterior) {
            const votosAnteriorQuery = await pool.query(`
                SELECT COALESCE(SUM(total_votos), 0) as votos_anterior
                FROM votos_agregados
                WHERE candidato_numero = $1 AND cargo = $2 AND ano = $3
            `, [candidatoNumero, cargo, anoAnterior]);
            const votosAnterior = parseInt(votosAnteriorQuery.rows[0]?.votos_anterior) || 0;
            potencialCrescimento = totalVotos - votosAnterior;
        }

        // Taxa de conversão
        const taxaConversao = totalGeral > 0 ? ((totalVotos / totalGeral) * 100).toFixed(2) : '0.00';

        // Meta 2026 (2.8x do valor atual)
        const meta2026 = Math.round(totalVotos * 2.8);

        return {
            metricas: [
                {
                    nome: 'Total de Votos',
                    valor: totalVotos.toLocaleString('pt-BR'),
                    status: totalVotos > 10000 ? 'BASE SÓLIDA' : totalVotos > 5000 ? 'EM CRESCIMENTO' : 'INICIANDO',
                    statusColor: totalVotos > 10000 ? 'green' : totalVotos > 5000 ? 'yellow' : 'gray'
                },
                {
                    nome: 'Taxa de Conversão',
                    valor: `${taxaConversao}%`,
                    status: parseFloat(taxaConversao) > 1 ? 'ALTA PERFORMANCE' : 'POTENCIAL ALTO',
                    statusColor: parseFloat(taxaConversao) > 1 ? 'green' : 'yellow'
                },
                {
                    nome: 'Municípios Alcançados',
                    valor: `${municipiosCandidato} de ${totalMunicipios}`,
                    status: municipiosCandidato > 80 ? 'COBERTURA AMPLA' : municipiosCandidato > 50 ? 'EXPANSÃO' : 'FOCO REGIONAL',
                    statusColor: municipiosCandidato > 80 ? 'green' : municipiosCandidato > 50 ? 'yellow' : 'orange'
                },
                {
                    nome: 'Zonas Eleitorais',
                    valor: zonas.toString(),
                    status: zonas > 100 ? 'PRESENÇA ESTADUAL' : zonas > 50 ? 'PRESENÇA REGIONAL' : 'PRESENÇA LOCAL',
                    statusColor: zonas > 100 ? 'green' : zonas > 50 ? 'yellow' : 'orange'
                },
                {
                    nome: 'Locais de Votação',
                    valor: locaisCandidato.toLocaleString('pt-BR'),
                    status: locaisCandidato > 3000 ? 'CAPILARIDADE' : locaisCandidato > 1000 ? 'BOA COBERTURA' : 'EXPANDINDO',
                    statusColor: locaisCandidato > 3000 ? 'green' : locaisCandidato > 1000 ? 'yellow' : 'orange'
                },
                {
                    nome: 'Concentração Capital',
                    valor: `${concentracaoCapital}%`,
                    status: parseFloat(concentracaoCapital) > 50 ? 'FOCO URBANO' : 'DISTRIBUÍDO',
                    statusColor: parseFloat(concentracaoCapital) > 50 ? 'blue' : 'green'
                },
                {
                    nome: 'Potencial Crescimento',
                    valor: potencialCrescimento >= 0 ? `+${potencialCrescimento.toLocaleString('pt-BR')}` : potencialCrescimento.toLocaleString('pt-BR'),
                    status: potencialCrescimento > 0 ? 'OPORTUNIDADE' : potencialCrescimento === 0 ? 'ESTÁVEL' : 'ATENÇÃO',
                    statusColor: potencialCrescimento > 0 ? 'yellow' : potencialCrescimento === 0 ? 'gray' : 'red'
                },
                {
                    nome: 'Meta 2026',
                    valor: `${meta2026.toLocaleString('pt-BR')} votos`,
                    status: 'OBJETIVO REALISTA',
                    statusColor: 'blue'
                }
            ],
            resumo: {
                totalVotos,
                taxaConversao: parseFloat(taxaConversao),
                municipiosAlcancados: municipiosCandidato,
                totalMunicipios,
                zonas,
                locais: locaisCandidato,
                concentracaoCapital: parseFloat(concentracaoCapital),
                potencialCrescimento,
                meta2026
            }
        };
    }

    /**
     * Distribuição por Municípios - Top 15 para barras, Top 6 + Outros para pizza
     */
    async getDistribuicaoMunicipios(candidatoNumero, cargo, ano) {
        // Top 15 municípios
        const top15Query = await pool.query(`
            SELECT 
                UPPER(lv.cidade) as municipio,
                SUM(va.total_votos) as votos
            FROM votos_agregados va
            JOIN locais_votacao lv ON va.local_id = lv.id
            WHERE va.candidato_numero = $1 AND va.cargo = $2 AND va.ano = $3
            GROUP BY UPPER(lv.cidade)
            ORDER BY votos DESC
            LIMIT 15
        `, [candidatoNumero, cargo, ano]);

        // Total para calcular percentuais
        const totalQuery = await pool.query(`
            SELECT COALESCE(SUM(total_votos), 0) as total
            FROM votos_agregados
            WHERE candidato_numero = $1 AND cargo = $2 AND ano = $3
        `, [candidatoNumero, cargo, ano]);
        const total = parseInt(totalQuery.rows[0]?.total) || 1;

        // Top 6 para pizza + calcular "Outros"
        const top6 = top15Query.rows.slice(0, 6).map(r => ({
            municipio: r.municipio,
            votos: parseInt(r.votos),
            percentual: ((parseInt(r.votos) / total) * 100).toFixed(1)
        }));

        const votosTop6 = top6.reduce((acc, m) => acc + m.votos, 0);
        const votosOutros = total - votosTop6;

        // Cores para o gráfico de pizza
        const coresPizza = ['#2c3e50', '#f1c40f', '#27ae60', '#3498db', '#e74c3c', '#9b59b6', '#95a5a6'];

        return {
            barChart: {
                labels: top15Query.rows.map(r => r.municipio),
                data: top15Query.rows.map(r => parseInt(r.votos)),
                ano
            },
            pieChart: {
                labels: [...top6.map(m => m.municipio), 'OUTROS'],
                data: [...top6.map(m => m.votos), votosOutros],
                percentuais: [...top6.map(m => parseFloat(m.percentual)), parseFloat(((votosOutros / total) * 100).toFixed(1))],
                cores: coresPizza
            },
            total
        };
    }

    /**
     * Top 20 Locais de Votação com maior votação
     */
    async getTop20Locais(candidatoNumero, cargo, ano) {
        const query = await pool.query(`
            SELECT 
                lv.nome_local,
                lv.cidade,
                SPLIT_PART(lv.id_tse, '-', 2) as zona,
                lv.bairro,
                va.total_votos
            FROM votos_agregados va
            JOIN locais_votacao lv ON va.local_id = lv.id
            WHERE va.candidato_numero = $1 AND va.cargo = $2 AND va.ano = $3
            ORDER BY va.total_votos DESC
            LIMIT 20
        `, [candidatoNumero, cargo, ano]);

        return {
            ranking: query.rows.map((row, index) => ({
                rank: index + 1,
                local: row.nome_local,
                municipioZona: `${row.cidade}, Zona ${row.zona}`,
                bairro: row.bairro,
                votos: parseInt(row.total_votos)
            })),
            ano
        };
    }
}

module.exports = new IntelligenceService();
