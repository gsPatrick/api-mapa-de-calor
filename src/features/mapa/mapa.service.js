const pool = require('../../config/database');
const cache = require('../../config/cache');

class MapaService {
    /**
     * Retorna dados para o heatmap/markers do mapa
     * @param {string} cargo - Cargo eleitoral
     * @param {string} numero - Número do candidato
     * @param {string} municipio - Filtro por cidade
     * @param {number} ano - Ano da eleição (2018 ou 2022)
     * @param {string} bairro - Filtro por bairro
     * @param {string} zona - Filtro por zona eleitoral
     * @param {string} partido - Filtro por partido
     */
    async getHeatmapData(cargo, numero, municipio, ano = 2022, bairro, zona, partido) {
        // Cache key inclui todos os filtros
        const cacheKey = `heatmap_${ano}_${cargo}_${numero}_${municipio || 'ALL'}_${bairro || 'ALL'}_${zona || 'ALL'}_${partido || 'ALL'}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Construir query dinâmica com filtros cumulativos
        let whereClause = 'WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL';
        const params = [cargo, ano, numero];
        let paramIndex = 4;

        // Filtro por município/cidade
        if (municipio) {
            whereClause += ` AND l.cidade = $${paramIndex++}`;
            params.push(municipio);
        }

        // Filtro por bairro
        if (bairro) {
            whereClause += ` AND l.bairro = $${paramIndex++}`;
            params.push(bairro);
        }

        // Filtro por zona (extraída do id_tse no formato MUNICIPIO-ZONA-LOCAL)
        if (zona) {
            whereClause += ` AND SPLIT_PART(l.id_tse, '-', 2) = $${paramIndex++}`;
            params.push(zona);
        }

        // Filtro por partido (precisa de subquery)
        let partidoJoin = '';
        if (partido) {
            partidoJoin = `
                INNER JOIN (
                    SELECT DISTINCT local_id 
                    FROM votos_agregados 
                    WHERE partido_sigla = $${paramIndex++} AND ano = $2
                ) vp ON l.id = vp.local_id
            `;
            params.push(partido);
        }

        // Query otimizada com CTEs para melhor performance
        const query = `
            WITH local_totals AS (
                SELECT local_id, SUM(total_votos) as total_cargo
                FROM votos_agregados
                WHERE cargo = $1 AND ano = $2
                GROUP BY local_id
            )
            SELECT 
                l.id,
                l.nome_local,
                l.bairro,
                l.cidade,
                l.latitude, 
                l.longitude, 
                COALESCE(v.total_votos, 0) as total_votos,
                COALESCE(totals.total_cargo, 0) as total_cargo
            FROM locais_votacao l
            ${partidoJoin}
            LEFT JOIN votos_agregados v ON l.id = v.local_id 
                AND v.cargo = $1 
                AND v.ano = $2 
                AND v.candidato_numero = $3
            LEFT JOIN local_totals totals ON l.id = totals.local_id
            ${whereClause}
        `;

        const result = await pool.query(query, params);

        const data = result.rows.map(row => ({
            id: row.id,
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude),
            votos: parseInt(row.total_votos),
            total_local: parseInt(row.total_cargo),
            percent: row.total_cargo > 0 ? parseFloat(((row.total_votos / row.total_cargo) * 100).toFixed(2)) : 0,
            nome: row.nome_local,
            bairro: row.bairro,
            cidade: row.cidade
        }));

        cache.set(cacheKey, data, 86400); // 24h
        return data;
    }

    /**
     * Retorna pontos estratégicos ativos para exibição no mapa
     */
    async getPontosEstrategicos() {
        const cacheKey = 'pontos_estrategicos_ativos';
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const query = `
            SELECT id, latitude, longitude, titulo, descricao, tipo_icone, cor
            FROM pontos_estrategicos
            WHERE ativo = true
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query);

        const pontos = result.rows.map(row => ({
            id: row.id,
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude),
            titulo: row.titulo,
            descricao: row.descricao,
            tipo_icone: row.tipo_icone,
            cor: row.cor
        }));

        cache.set(cacheKey, pontos, 300); // 5 min cache
        return pontos;
    }
}

module.exports = new MapaService();
