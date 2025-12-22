const pool = require('../../config/database');
const cache = require('../../config/cache');

class MapaService {
    async getHeatmapData(cargo, numero, municipio, ano = 2022) {
        const cacheKey = `heatmap_${ano}_${cargo}_${numero}_${municipio || 'ALL'}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Query to get votes for candidate AND total votes of that cargo in that local
        // Filtered by election year
        // MODIFIED: Select from locais_votacao to ensure ALL schools appear
        let query = `
            WITH local_totals AS (
                SELECT local_id, SUM(total_votos) as total_cargo
                FROM votos_agregados
                WHERE cargo = $1 AND ano = $2
                GROUP BY local_id
            )
            SELECT 
                l.id,
                l.nome_local,
                l.latitude, 
                l.longitude, 
                COALESCE(v.total_votos, 0) as total_votos,
                COALESCE(totals.total_cargo, 0) as total_cargo
            FROM locais_votacao l
            LEFT JOIN votos_agregados v ON l.id = v.local_id AND v.cargo = $1 AND v.ano = $2 AND v.candidato_numero = $3
            LEFT JOIN local_totals totals ON l.id = totals.local_id
            WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
        `;

        const params = [cargo, ano, numero];

        if (municipio) {
            query += ` AND l.cidade = $4`; // Note: using 'cidade' column in DB which maps to 'municipio' filter
            params.push(municipio);
        }

        const result = await pool.query(query, params);

        const data = result.rows.map(row => ({
            id: row.id,
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude),
            votos: parseInt(row.total_votos), // Absolute
            total_local: parseInt(row.total_cargo),
            percent: row.total_cargo > 0 ? parseFloat(((row.total_votos / row.total_cargo) * 100).toFixed(2)) : 0,
            nome: row.nome_local
        }));

        cache.set(cacheKey, data, 86400); // 24h
        return data;
    }
}

module.exports = new MapaService();
