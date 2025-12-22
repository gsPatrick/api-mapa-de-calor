const pool = require('../../config/database');

class EscolasService {
    async getRanking(localId, cargo, ano) {
        let query = `
            SELECT cargo, candidato_numero, candidato_nome, partido_sigla, total_votos
            FROM votos_agregados
            WHERE local_id = $1
        `;

        const params = [localId];
        let paramIndex = 2;

        if (cargo) {
            query += ` AND cargo = $${paramIndex}`;
            params.push(cargo);
            paramIndex++;
        }

        if (ano) {
            query += ` AND ano = $${paramIndex}`;
            params.push(ano);
            paramIndex++;
        }

        query += ` ORDER BY total_votos DESC`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    async getDetails(localId) {
        const query = `SELECT * FROM locais_votacao WHERE id = $1`;
        const result = await pool.query(query, [localId]);
        return result.rows[0];
    }

    async searchByName(term) {
        const query = `
            SELECT id, nome_local, endereco, bairro, cidade, latitude, longitude
            FROM locais_votacao
            WHERE nome_local ILIKE $1
            ORDER BY nome_local
            LIMIT 20
        `;
        const result = await pool.query(query, [`%${term}%`]);
        return result.rows;
    }
}

const service = new EscolasService();

class EscolasController {
    async getRanking(req, res) {
        try {
            const { id } = req.params;
            const { cargo, ano } = req.query;

            if (!id) return res.status(400).json({ error: 'ID da escola obrigatório' });

            const ranking = await service.getRanking(id, cargo, ano);
            const details = await service.getDetails(id);

            res.json({ details, ranking });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao buscar dados da escola' });
        }
    }

    async search(req, res) {
        try {
            const { q } = req.query;
            if (!q || q.length < 2) {
                return res.status(400).json({ error: 'Termo de busca deve ter pelo menos 2 caracteres' });
            }
            const results = await service.searchByName(q);
            res.json(results);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro na busca' });
        }
    }
}

module.exports = new EscolasController();

