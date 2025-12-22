const adminService = require('./admin.service');

class AdminController {
    // =====================================================
    // LOCAIS DE VOTAÇÃO
    // =====================================================

    /**
     * GET /api/admin/locais
     * Query: page, limit, search
     */
    async getLocais(req, res) {
        try {
            const { page = 1, limit = 50, search = '' } = req.query;
            const result = await adminService.getLocais(
                parseInt(page),
                parseInt(limit),
                search
            );
            res.json(result);
        } catch (error) {
            console.error('Erro ao listar locais:', error);
            res.status(500).json({ error: 'Erro ao listar locais de votação' });
        }
    }

    /**
     * GET /api/admin/locais/:id
     */
    async getLocalById(req, res) {
        try {
            const { id } = req.params;
            const local = await adminService.getLocalById(id);

            if (!local) {
                return res.status(404).json({ error: 'Local não encontrado' });
            }

            res.json(local);
        } catch (error) {
            console.error('Erro ao buscar local:', error);
            res.status(500).json({ error: 'Erro ao buscar local de votação' });
        }
    }

    /**
     * PUT /api/admin/locais/:id
     */
    async updateLocal(req, res) {
        try {
            const { id } = req.params;
            const local = await adminService.updateLocal(id, req.body);

            if (!local) {
                return res.status(404).json({ error: 'Local não encontrado' });
            }

            res.json({
                message: 'Local atualizado com sucesso',
                local
            });
        } catch (error) {
            console.error('Erro ao atualizar local:', error);
            res.status(500).json({ error: 'Erro ao atualizar local de votação' });
        }
    }

    // =====================================================
    // PONTOS ESTRATÉGICOS
    // =====================================================

    /**
     * GET /api/admin/pontos
     * Query: all (se true, retorna inativos também)
     */
    async getPontos(req, res) {
        try {
            const { all } = req.query;
            const pontos = await adminService.getPontos(all !== 'true');
            res.json(pontos);
        } catch (error) {
            console.error('Erro ao listar pontos:', error);
            res.status(500).json({ error: 'Erro ao listar pontos estratégicos' });
        }
    }

    /**
     * GET /api/admin/pontos/:id
     */
    async getPontoById(req, res) {
        try {
            const { id } = req.params;
            const ponto = await adminService.getPontoById(id);

            if (!ponto) {
                return res.status(404).json({ error: 'Ponto não encontrado' });
            }

            res.json(ponto);
        } catch (error) {
            console.error('Erro ao buscar ponto:', error);
            res.status(500).json({ error: 'Erro ao buscar ponto estratégico' });
        }
    }

    /**
     * POST /api/admin/pontos
     * Body: { latitude, longitude, titulo, descricao?, tipo_icone?, cor? }
     */
    async createPonto(req, res) {
        try {
            const { latitude, longitude, titulo } = req.body;

            if (!latitude || !longitude || !titulo) {
                return res.status(400).json({
                    error: 'Latitude, longitude e título são obrigatórios'
                });
            }

            const ponto = await adminService.createPonto(req.body, req.user.id);

            res.status(201).json({
                message: 'Ponto criado com sucesso',
                ponto
            });
        } catch (error) {
            console.error('Erro ao criar ponto:', error);
            res.status(500).json({ error: 'Erro ao criar ponto estratégico' });
        }
    }

    /**
     * PUT /api/admin/pontos/:id
     */
    async updatePonto(req, res) {
        try {
            const { id } = req.params;
            const ponto = await adminService.updatePonto(id, req.body);

            if (!ponto) {
                return res.status(404).json({ error: 'Ponto não encontrado' });
            }

            res.json({
                message: 'Ponto atualizado com sucesso',
                ponto
            });
        } catch (error) {
            console.error('Erro ao atualizar ponto:', error);
            res.status(500).json({ error: 'Erro ao atualizar ponto estratégico' });
        }
    }

    /**
     * DELETE /api/admin/pontos/:id
     * Query: hard (se true, deleta permanentemente)
     */
    async deletePonto(req, res) {
        try {
            const { id } = req.params;
            const { hard } = req.query;

            let ponto;
            if (hard === 'true') {
                ponto = await adminService.hardDeletePonto(id);
            } else {
                ponto = await adminService.deletePonto(id);
            }

            if (!ponto) {
                return res.status(404).json({ error: 'Ponto não encontrado' });
            }

            res.json({
                message: hard === 'true' ? 'Ponto removido permanentemente' : 'Ponto desativado com sucesso',
                ponto
            });
        } catch (error) {
            console.error('Erro ao deletar ponto:', error);
            res.status(500).json({ error: 'Erro ao deletar ponto estratégico' });
        }
    }

    // =====================================================
    // CONFIGURAÇÕES
    // =====================================================

    /**
     * GET /api/admin/config
     */
    async getConfiguracoes(req, res) {
        try {
            const config = await adminService.getConfiguracoes();
            res.json(config);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            res.status(500).json({ error: 'Erro ao buscar configurações' });
        }
    }

    /**
     * PUT /api/admin/config/:chave
     * Body: { valor }
     */
    async updateConfiguracao(req, res) {
        try {
            const { chave } = req.params;
            const { valor } = req.body;

            if (valor === undefined) {
                return res.status(400).json({ error: 'Valor é obrigatório' });
            }

            const config = await adminService.updateConfiguracao(chave, valor);

            res.json({
                message: 'Configuração atualizada',
                config
            });
        } catch (error) {
            console.error('Erro ao atualizar configuração:', error);
            res.status(500).json({ error: 'Erro ao atualizar configuração' });
        }
    }

    // =====================================================
    // ESTATÍSTICAS
    // =====================================================

    /**
     * GET /api/admin/stats
     */
    async getStats(req, res) {
        try {
            const stats = await adminService.getAdminStats();
            res.json(stats);
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas' });
        }
    }
}

module.exports = new AdminController();
