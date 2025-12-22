require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const pool = require('./config/database');
const { runMigrations } = require('./migrations');

const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(compression()); // Enable Gzip
app.use(cors());
app.use(express.json());

// Static files for candidate photos
app.use('/fotos/2022', express.static(path.join(__dirname, '../foto_cand2022_RJ_div')));
app.use('/fotos/2018', express.static(path.join(__dirname, '../2018/foto_cand2018_RJ_div')));

// Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => res.send('API Mapa Eleitoral RJ 2018/2022 Online'));

// Iniciar servidor com migrations
async function startServer() {
    try {
        // Executar migrations antes de iniciar
        console.log('\n🗳️  API Mapa Eleitoral RJ');
        console.log('========================================\n');

        await runMigrations();

        console.log('\n========================================');

        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
            console.log(`📍 http://localhost:${PORT}\n`);
        });
    } catch (err) {
        console.error('❌ Erro ao iniciar servidor:', err);
        process.exit(1);
    }
}

startServer();
