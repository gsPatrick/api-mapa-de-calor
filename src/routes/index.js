const express = require('express');
const router = express.Router();

const mapaController = require('../features/mapa/mapa.controller');
const candidatosController = require('../features/candidatos/candidatos.controller');
const escolasController = require('../features/escolas/escolas.controller');

// Rotas Mapa
router.get('/mapa', mapaController.getHeatmap);

// Rotas Candidatos (Filtros)
router.get('/filtros', candidatosController.listar);
router.get('/municipios', candidatosController.listarMunicipios);

// Rotas Escolas
router.get('/escolas/busca', escolasController.search);
router.get('/escolas/:id', escolasController.getRanking);

// Rotas Stats
const statsController = require('../features/stats/stats.controller');
router.get('/stats', statsController.getStats);

module.exports = router;
