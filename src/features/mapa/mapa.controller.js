const mapaService = require('./mapa.service');

class MapaController {
    /**
     * GET /api/mapa
     * Retorna dados para heatmap/markers com filtros avançados
     * Query params: cargo, numero, municipio, ano, bairro, zona, partido
     */
    async getHeatmap(req, res) {
        try {
            const { cargo, numero, municipio, ano, bairro, zona, partido } = req.query;

            // Default to 2022 if ano not specified
            const year = ano ? parseInt(ano) : 2022;

            const points = await mapaService.getHeatmapData(
                cargo,
                numero,
                municipio,
                year,
                bairro,
                zona,
                partido
            );
            res.json(points);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro interno ao buscar dados do mapa' });
        }
    }

    /**
     * GET /api/mapa/pontos-estrategicos
     * Retorna pontos estratégicos ativos para exibição no mapa
     */
    async getPontosEstrategicos(req, res) {
        try {
            const pontos = await mapaService.getPontosEstrategicos();
            res.json(pontos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao buscar pontos estratégicos' });
        }
    }
}

module.exports = new MapaController();
