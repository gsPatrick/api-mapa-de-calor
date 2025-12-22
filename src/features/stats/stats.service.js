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
}

module.exports = new StatsService();
