require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const pool = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Static files for candidate photos
app.use('/fotos/2022', express.static(path.join(__dirname, '../foto_cand2022_RJ_div')));
app.use('/fotos/2018', express.static(path.join(__dirname, '../2018/foto_cand2018_RJ_div')));

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => res.send('API Mapa Eleitoral RJ 2018/2022 Online'));

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

