const pool = require('../../config/database');
const cache = require('../../config/cache');

class FiltrosService {
    /**
     * Retorna lista de bairros únicos dos locais de votação
     */
    async getBairros() {
        const cacheKey = 'lista_bairros';
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const query = `
            SELECT DISTINCT bairro 
            FROM locais_votacao 
            WHERE bairro IS NOT NULL AND bairro != ''
            ORDER BY bairro
        `;
        
        const result = await pool.query(query);
        const bairros = result.rows.map(r => r.bairro);
        
        cache.set(cacheKey, bairros, 86400); // 24h cache
        return bairros;
    }

    /**
     * Retorna lista de zonas eleitorais únicas
     * Zona é extraída do id_tse no formato: MUNICIPIO-ZONA-LOCAL
     */
    async getZonas() {
        const cacheKey = 'lista_zonas';
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const query = `
            SELECT DISTINCT SPLIT_PART(id_tse, '-', 2) as zona
            FROM locais_votacao 
            WHERE id_tse IS NOT NULL
            ORDER BY zona
        `;
        
        const result = await pool.query(query);
        const zonas = result.rows.map(r => r.zona).filter(z => z);
        
        cache.set(cacheKey, zonas, 86400); // 24h cache
        return zonas;
    }

    /**
     * Retorna lista de partidos presentes nos votos agregados
     * Opcionalmente filtra por ano
     */
    async getPartidos(ano = null) {
        const cacheKey = `lista_partidos_${ano || 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        let query = `
            SELECT DISTINCT partido_sigla, COUNT(*) as total_candidatos
            FROM votos_agregados 
            WHERE partido_sigla IS NOT NULL AND partido_sigla != ''
        `;
        
        const params = [];
        
        if (ano) {
            query += ` AND ano = $1`;
            params.push(ano);
        }
        
        query += ` GROUP BY partido_sigla ORDER BY total_candidatos DESC`;
        
        const result = await pool.query(query, params);
        
        cache.set(cacheKey, result.rows, 86400); // 24h cache
        return result.rows;
    }

    /**
     * Retorna lista de cargos disponíveis
     */
    async getCargos(ano = null) {
        const cacheKey = `lista_cargos_${ano || 'all'}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        let query = `
            SELECT DISTINCT cargo
            FROM votos_agregados 
            WHERE cargo IS NOT NULL
        `;
        
        const params = [];
        
        if (ano) {
            query += ` AND ano = $1`;
            params.push(ano);
        }
        
        query += ` ORDER BY cargo`;
        
        const result = await pool.query(query, params);
        const cargos = result.rows.map(r => r.cargo);
        
        cache.set(cacheKey, cargos, 86400);
        return cargos;
    }
}

module.exports = new FiltrosService();
