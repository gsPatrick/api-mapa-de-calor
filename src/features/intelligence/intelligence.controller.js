/**
 * Intelligence Controller - BI Analytics Suite
 */

const intelligenceService = require('./intelligence.service');

class IntelligenceController {

    async getResumoExecutivo(req, res) {
        try {
            const { candidato, cargo, ano } = req.query;

            if (!candidato || !cargo || !ano) {
                return res.status(400).json({
                    error: 'Parâmetros obrigatórios: candidato, cargo, ano'
                });
            }

            const data = await intelligenceService.getResumoExecutivo(candidato, cargo, parseInt(ano));
            res.json(data);
        } catch (error) {
            console.error('Erro em getResumoExecutivo:', error);
            res.status(500).json({ error: 'Erro ao gerar resumo executivo' });
        }
    }

    async getDistribuicaoMunicipios(req, res) {
        try {
            const { candidato, cargo, ano } = req.query;

            if (!candidato || !cargo || !ano) {
                return res.status(400).json({
                    error: 'Parâmetros obrigatórios: candidato, cargo, ano'
                });
            }

            const data = await intelligenceService.getDistribuicaoMunicipios(candidato, cargo, parseInt(ano));
            res.json(data);
        } catch (error) {
            console.error('Erro em getDistribuicaoMunicipios:', error);
            res.status(500).json({ error: 'Erro ao gerar distribuição por municípios' });
        }
    }

    async getTop20Locais(req, res) {
        try {
            const { candidato, cargo, ano } = req.query;

            if (!candidato || !cargo || !ano) {
                return res.status(400).json({
                    error: 'Parâmetros obrigatórios: candidato, cargo, ano'
                });
            }

            const data = await intelligenceService.getTop20Locais(candidato, cargo, parseInt(ano));
            res.json(data);
        } catch (error) {
            console.error('Erro em getTop20Locais:', error);
            res.status(500).json({ error: 'Erro ao gerar ranking de locais' });
        }
    }
}

module.exports = new IntelligenceController();
