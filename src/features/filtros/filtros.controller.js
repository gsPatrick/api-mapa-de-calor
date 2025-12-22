const filtrosService = require('./filtros.service');

class FiltrosController {
    /**
     * GET /api/filtros/bairros
     * Retorna lista de bairros únicos
     */
    async getBairros(req, res) {
        try {
            const bairros = await filtrosService.getBairros();
            res.json(bairros);
        } catch (error) {
            console.error('Erro ao listar bairros:', error);
            res.status(500).json({ error: 'Erro ao listar bairros' });
        }
    }

    /**
     * GET /api/filtros/zonas
     * Retorna lista de zonas eleitorais únicas
     */
    async getZonas(req, res) {
        try {
            const zonas = await filtrosService.getZonas();
            res.json(zonas);
        } catch (error) {
            console.error('Erro ao listar zonas:', error);
            res.status(500).json({ error: 'Erro ao listar zonas' });
        }
    }

    /**
     * GET /api/filtros/partidos
     * Query params: ano (opcional)
     */
    async getPartidos(req, res) {
        try {
            const { ano } = req.query;
            const partidos = await filtrosService.getPartidos(ano ? parseInt(ano) : null);
            res.json(partidos);
        } catch (error) {
            console.error('Erro ao listar partidos:', error);
            res.status(500).json({ error: 'Erro ao listar partidos' });
        }
    }

    /**
     * GET /api/filtros/cargos
     * Query params: ano (opcional)
     */
    async getCargos(req, res) {
        try {
            const { ano } = req.query;
            const cargos = await filtrosService.getCargos(ano ? parseInt(ano) : null);
            res.json(cargos);
        } catch (error) {
            console.error('Erro ao listar cargos:', error);
            res.status(500).json({ error: 'Erro ao listar cargos' });
        }
    }
}

module.exports = new FiltrosController();
