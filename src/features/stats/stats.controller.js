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
}

module.exports = new StatsController();
