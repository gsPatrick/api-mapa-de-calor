const mapaService = require('./mapa.service');

class MapaController {
    async getHeatmap(req, res) {
        try {
            const { cargo, numero, municipio, ano } = req.query;

            // if (!cargo || !numero) {
            //     return res.status(400).json({ error: 'Parâmetros cargo e numero são obrigatórios' });
            // }

            // Default to 2022 if ano not specified
            const year = ano ? parseInt(ano) : 2022;

            const points = await mapaService.getHeatmapData(cargo, numero, municipio, year);
            res.json(points);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro interno ao buscar dados do mapa' });
        }
    }
}

module.exports = new MapaController();
