const express = require('express');
const router = express.Router();

// Controllers
const mapaController = require('../features/mapa/mapa.controller');
const candidatosController = require('../features/candidatos/candidatos.controller');
const escolasController = require('../features/escolas/escolas.controller');
const statsController = require('../features/stats/stats.controller');
const filtrosController = require('../features/filtros/filtros.controller');
const authController = require('../features/auth/auth.controller');
const adminController = require('../features/admin/admin.controller');
const intelligenceController = require('../features/intelligence/intelligence.controller');

// Middleware
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

// =====================================================
// ROTAS PÚBLICAS
// =====================================================

// Mapa
router.get('/mapa', mapaController.getHeatmap);
router.get('/mapa/pontos-estrategicos', mapaController.getPontosEstrategicos);

// Candidatos (Filtros legados)
router.get('/filtros', candidatosController.listar);
router.get('/municipios', candidatosController.listarMunicipios);

// Filtros Avançados
router.get('/filtros/bairros', filtrosController.getBairros);
router.get('/filtros/zonas', filtrosController.getZonas);
router.get('/filtros/partidos', filtrosController.getPartidos);
router.get('/filtros/cargos', filtrosController.getCargos);

// Escolas
router.get('/escolas/busca', escolasController.search);
router.get('/escolas/:id', escolasController.getRanking);

// Estatísticas
router.get('/stats', statsController.getStats);
router.get('/stats/crescimento', statsController.getCrescimento);

// Inteligência (BI Analytics)
router.get('/intelligence/resumo-executivo', intelligenceController.getResumoExecutivo);
router.get('/intelligence/distribuicao-municipios', intelligenceController.getDistribuicaoMunicipios);
router.get('/intelligence/top20-locais', intelligenceController.getTop20Locais);

// =====================================================
// ROTAS DE AUTENTICAÇÃO
// =====================================================

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/verify', authController.verifyToken);

// Rotas que requerem autenticação
router.get('/auth/me', authMiddleware, authController.me);
router.put('/auth/profile', authMiddleware, authController.updateProfile);
router.put('/auth/password', authMiddleware, authController.changePassword);

// =====================================================
// ROTAS ADMINISTRATIVAS (Protegidas)
// =====================================================

// Estatísticas Admin
router.get('/admin/stats', authMiddleware, requireRole('admin', 'editor'), adminController.getStats);

// Locais de Votação
router.get('/admin/locais', authMiddleware, requireRole('admin', 'editor'), adminController.getLocais);
router.get('/admin/locais/:id', authMiddleware, requireRole('admin', 'editor'), adminController.getLocalById);
router.put('/admin/locais/:id', authMiddleware, requireRole('admin', 'editor'), adminController.updateLocal);

// Pontos Estratégicos
router.get('/admin/pontos', authMiddleware, requireRole('admin', 'editor'), adminController.getPontos);
router.get('/admin/pontos/:id', authMiddleware, requireRole('admin', 'editor'), adminController.getPontoById);
router.post('/admin/pontos', authMiddleware, requireRole('admin', 'editor'), adminController.createPonto);
router.put('/admin/pontos/:id', authMiddleware, requireRole('admin', 'editor'), adminController.updatePonto);
router.delete('/admin/pontos/:id', authMiddleware, requireRole('admin'), adminController.deletePonto);

// Configurações do Mapa
router.get('/admin/config', authMiddleware, requireRole('admin'), adminController.getConfiguracoes);
router.put('/admin/config/:chave', authMiddleware, requireRole('admin'), adminController.updateConfiguracao);

module.exports = router;
