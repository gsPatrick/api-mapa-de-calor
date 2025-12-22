const pool = require('../src/config/database');

async function createIndexes() {
    console.log('Criando índices para ano...');
    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_votos_ano ON votos_agregados (ano);`);
        console.log('idx_votos_ano criado');

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_votos_ano_cargo_numero ON votos_agregados (ano, cargo, candidato_numero);`);
        console.log('idx_votos_ano_cargo_numero criado');

        console.log('Índices criados com sucesso!');
    } catch (err) {
        console.error('Erro:', err.message);
    }
    process.exit();
}

createIndexes();
