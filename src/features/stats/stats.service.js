const pool = require('../../config/database');
const cache = require('../../config/cache');

class StatsService {
    async getStats(filters) {
        const { ano, cargo, municipio, zona, bairro } = filters;
        const cacheKey = `stats_${JSON.stringify(filters)}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Base Filter Logic
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filter by Year (Required)
        const selectedYear = ano ? parseInt(ano) : 2022;
        whereClause += ` AND v.ano = $${paramIndex++}`;
        params.push(selectedYear);

        if (cargo) {
            whereClause += ` AND v.cargo = $${paramIndex++}`;
            params.push(cargo);
        }
        if (municipio) {
            whereClause += ` AND l.cidade = $${paramIndex++}`;
            params.push(municipio);
        }
        if (zona) {
            // Zona is encoded in id_tse (MUN-ZONA-LOCAL)
            whereClause += ` AND SPLIT_PART(l.id_tse, '-', 2) = $${paramIndex++}`;
            params.push(zona);
        }
        if (bairro) {
            whereClause += ` AND l.bairro = $${paramIndex++}`;
            params.push(bairro);
        }

        // 1. Summary Metrics
        // Total Votos, Total Seções (approximated by local_id distinct since secoes not stored in agg), Total Candidatos, Total Zonas
        const summaryQuery = `
            SELECT 
                SUM(v.total_votos) as total_votos,
                COUNT(DISTINCT v.local_id) as total_locais,
                COUNT(DISTINCT v.candidato_numero) as total_candidatos,
                COUNT(DISTINCT SPLIT_PART(l.id_tse, '-', 2)) as total_zonas
            FROM votos_agregados v
            JOIN locais_votacao l ON v.local_id = l.id
            ${whereClause}
        `;
        const summaryRes = await pool.query(summaryQuery, params);

        const topCandidatesQuery = `
            SELECT 
                v.candidato_nome,
                v.candidato_numero,
                v.partido_sigla,
                SUM(v.total_votos) as votos
            FROM votos_agregados v
            JOIN locais_votacao l ON v.local_id = l.id
            ${whereClause}
            GROUP BY v.candidato_nome, v.candidato_numero, v.partido_sigla
            ORDER BY votos DESC
            LIMIT 5
        `;
        const topRes = await pool.query(topCandidatesQuery, params);

        // 3. Party Distribution
        const partyQuery = `
            SELECT 
                v.partido_sigla,
                SUM(v.total_votos) as votos
            FROM votos_agregados v
            JOIN locais_votacao l ON v.local_id = l.id
            ${whereClause}
            GROUP BY v.partido_sigla
            ORDER BY votos DESC
        `;
        const partyRes = await pool.query(partyQuery, params);

        // Calculate Percentages for Top Candidates
        const totalVotes = parseInt(summaryRes.rows[0].total_votos || 0);
        const topCandidates = topRes.rows.map(c => ({
            ...c,
            percent: totalVotes > 0 ? ((c.votos / totalVotes) * 100).toFixed(2) : 0
        }));

        const result = {
            summary: {
                total_votos: parseInt(summaryRes.rows[0].total_votos || 0),
                total_locais: parseInt(summaryRes.rows[0].total_locais || 0), // approximating sections as locais here, or could sum secoes column if exists (it doesn't in agg)
                total_candidatos: parseInt(summaryRes.rows[0].total_candidatos || 0),
                total_zonas: parseInt(summaryRes.rows[0].total_zonas || 0)
            },
            topCandidates,
            partyDistribution: partyRes.rows // Frontend can limit or group 'Others'
        };

        cache.set(cacheKey, result, 300); // 5 min cache
        return result;
    }

    /**
     * Analisa crescimento de um candidato entre 2018 e 2022
     * Compara votos por local_id e retorna ranking de evolução
     */
    async getCrescimento(filters) {
        const { candidato, cargo } = filters;

        if (!candidato || !cargo) {
            throw new Error('Candidato e cargo são obrigatórios');
        }

        const cacheKey = `crescimento_${candidato}_${cargo}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Query para obter votos do candidato em 2018 e 2022 por local
        const query = `
            WITH votos_2018 AS (
                SELECT 
                    v.local_id,
                    l.nome_local,
                    l.bairro,
                    l.cidade,
                    l.latitude,
                    l.longitude,
                    v.total_votos as votos_2018
                FROM votos_agregados v
                JOIN locais_votacao l ON v.local_id = l.id
                WHERE v.ano = 2018 
                  AND v.candidato_numero = $1 
                  AND v.cargo = $2
            ),
            votos_2022 AS (
                SELECT 
                    v.local_id,
                    v.total_votos as votos_2022
                FROM votos_agregados v
                WHERE v.ano = 2022 
                  AND v.candidato_numero = $1 
                  AND v.cargo = $2
            )
            SELECT 
                COALESCE(v18.local_id, v22.local_id) as local_id,
                COALESCE(v18.nome_local, l.nome_local) as nome_local,
                COALESCE(v18.bairro, l.bairro) as bairro,
                COALESCE(v18.cidade, l.cidade) as cidade,
                COALESCE(v18.latitude, l.latitude) as latitude,
                COALESCE(v18.longitude, l.longitude) as longitude,
                COALESCE(v18.votos_2018, 0) as votos_2018,
                COALESCE(v22.votos_2022, 0) as votos_2022,
                COALESCE(v22.votos_2022, 0) - COALESCE(v18.votos_2018, 0) as variacao_nominal,
                CASE 
                    WHEN COALESCE(v18.votos_2018, 0) > 0 
                    THEN ROUND(((COALESCE(v22.votos_2022, 0) - v18.votos_2018)::numeric / v18.votos_2018 * 100), 2)
                    ELSE NULL 
                END as variacao_percentual
            FROM votos_2018 v18
            FULL OUTER JOIN votos_2022 v22 ON v18.local_id = v22.local_id
            LEFT JOIN locais_votacao l ON COALESCE(v18.local_id, v22.local_id) = l.id
            WHERE COALESCE(v18.votos_2018, 0) > 0 OR COALESCE(v22.votos_2022, 0) > 0
            ORDER BY variacao_nominal DESC
        `;

        const result = await pool.query(query, [candidato, cargo]);

        // Calcular totais
        const totals = result.rows.reduce((acc, row) => ({
            total_2018: acc.total_2018 + parseInt(row.votos_2018),
            total_2022: acc.total_2022 + parseInt(row.votos_2022)
        }), { total_2018: 0, total_2022: 0 });

        const response = {
            candidato,
            cargo,
            resumo: {
                total_2018: totals.total_2018,
                total_2022: totals.total_2022,
                variacao_nominal: totals.total_2022 - totals.total_2018,
                variacao_percentual: totals.total_2018 > 0
                    ? ((totals.total_2022 - totals.total_2018) / totals.total_2018 * 100).toFixed(2)
                    : null,
                total_locais_analisados: result.rows.length
            },
            top_crescimento: result.rows.slice(0, 10).map(r => ({
                ...r,
                votos_2018: parseInt(r.votos_2018),
                votos_2022: parseInt(r.votos_2022),
                variacao_nominal: parseInt(r.variacao_nominal),
                latitude: parseFloat(r.latitude),
                longitude: parseFloat(r.longitude)
            })),
            top_queda: result.rows.slice(-10).reverse().map(r => ({
                ...r,
                votos_2018: parseInt(r.votos_2018),
                votos_2022: parseInt(r.votos_2022),
                variacao_nominal: parseInt(r.variacao_nominal),
                latitude: parseFloat(r.latitude),
                longitude: parseFloat(r.longitude)
            }))
        };

        cache.set(cacheKey, response, 300);
        return response;
    }
}

module.exports = new StatsService();
