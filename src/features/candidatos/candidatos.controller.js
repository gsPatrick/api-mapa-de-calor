const pool = require('../../config/database');
const cache = require('../../config/cache');

class CandidatosService {
    async getAll(ano = 2022) {
        const cacheKey = `lista_candidatos_${ano}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Distinct list of candidates present in agregados for specific year
        // Joined with metadata for photo ID
        const query = `
            SELECT DISTINCT v.cargo, v.candidato_numero, v.candidato_nome, v.partido_sigla
            FROM votos_agregados v
            WHERE v.ano = $1
            ORDER BY v.cargo, v.candidato_nome
        `;
        const result = await pool.query(query, [ano]);

        cache.set(cacheKey, result.rows, 86400);
        return result.rows;
    }

    async getMunicipios() {
        const cacheKey = 'lista_municipios';
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const query = `
            SELECT DISTINCT cidade as municipio 
            FROM locais_votacao 
            WHERE cidade IS NOT NULL 
            ORDER BY cidade
        `;
        const result = await pool.query(query);
        const municipios = result.rows.map(r => r.municipio);

        cache.set(cacheKey, municipios, 86400);
        return municipios;
    }
}

const service = new CandidatosService();

class CandidatosController {
    async listar(req, res) {
        try {
            const { ano } = req.query;
            const year = ano ? parseInt(ano) : 2022;
            const list = await service.getAll(year);
            res.json(list);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao listar candidatos' });
        }
    }

    async listarMunicipios(req, res) {
        try {
            const list = await service.getMunicipios();
            res.json(list);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao listar municípios' });
        }
    }
}

module.exports = new CandidatosController();

