const statsService = require('./stats.service');

class StatsController {
    async getStats(req, res) {
        try {
            // Cargo is mandatory for meaningful stats
            if (!req.query.cargo) {
                return res.status(400).json({ error: 'Parâmetro cargo é obrigatório' });
            }

            const data = await statsService.getStats(req.query);
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas' });
        }
    }

    /**
     * GET /api/stats/crescimento
     * Query params: candidato, cargo
     * Retorna análise de crescimento 2018 vs 2022
     */
    async getCrescimento(req, res) {
        try {
            const { candidato, cargo } = req.query;

            if (!candidato || !cargo) {
                return res.status(400).json({
                    error: 'Parâmetros candidato e cargo são obrigatórios'
                });
            }

            const data = await statsService.getCrescimento({ candidato, cargo });
            res.json(data);
        } catch (error) {
            console.error('Erro ao buscar crescimento:', error);
            res.status(500).json({ error: 'Erro ao buscar dados de crescimento' });
        }
    }
}

module.exports = new StatsController();
