const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Sistema de Migrations Simples
 * Executa migrations automaticamente ao iniciar o servidor
 */

// Criar tabela de controle de migrations (se não existir)
const createMigrationsTable = `
    CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

// Lista de migrations em ordem
const migrations = [
    {
        name: '001_initial_schema',
        up: `
            -- Tabela de locais de votação
            CREATE TABLE IF NOT EXISTS locais_votacao (
                id SERIAL PRIMARY KEY,
                id_tse VARCHAR(50) UNIQUE NOT NULL,
                nome_local VARCHAR(255) NOT NULL,
                endereco TEXT,
                bairro VARCHAR(100),
                cidade VARCHAR(100),
                latitude DECIMAL(9, 6),
                longitude DECIMAL(9, 6)
            );

            -- Tabela de votos agregados
            CREATE TABLE IF NOT EXISTS votos_agregados (
                id SERIAL PRIMARY KEY,
                ano INTEGER DEFAULT 2022,
                cargo VARCHAR(50),
                candidato_nome VARCHAR(255),
                candidato_numero VARCHAR(20),
                partido_sigla VARCHAR(20),
                local_id INTEGER REFERENCES locais_votacao(id),
                total_votos INTEGER DEFAULT 0,
                UNIQUE (ano, cargo, candidato_numero, local_id)
            );

            -- Índices básicos
            CREATE INDEX IF NOT EXISTS idx_votos_candidato ON votos_agregados (candidato_numero);
            CREATE INDEX IF NOT EXISTS idx_votos_cargo ON votos_agregados (cargo);
            CREATE INDEX IF NOT EXISTS idx_votos_local ON votos_agregados (local_id);
            CREATE INDEX IF NOT EXISTS idx_votos_ano ON votos_agregados (ano);
            CREATE INDEX IF NOT EXISTS idx_votos_cargo_local ON votos_agregados (cargo, local_id);
            CREATE INDEX IF NOT EXISTS idx_votos_candidato_ano_cargo ON votos_agregados (candidato_numero, ano, cargo);
        `
    },
    {
        name: '002_usuarios_table',
        up: `
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);
        `
    },
    {
        name: '003_pontos_estrategicos_table',
        up: `
            CREATE TABLE IF NOT EXISTS pontos_estrategicos (
                id SERIAL PRIMARY KEY,
                latitude DECIMAL(9, 6) NOT NULL,
                longitude DECIMAL(9, 6) NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                descricao TEXT,
                tipo_icone VARCHAR(50) DEFAULT 'star',
                cor VARCHAR(20) DEFAULT '#FF5722',
                criado_por INTEGER REFERENCES usuarios(id),
                ativo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_pontos_criado_por ON pontos_estrategicos (criado_por);
            CREATE INDEX IF NOT EXISTS idx_pontos_ativos ON pontos_estrategicos (ativo) WHERE ativo = true;
        `
    },
    {
        name: '004_configuracoes_mapa_table',
        up: `
            CREATE TABLE IF NOT EXISTS configuracoes_mapa (
                id SERIAL PRIMARY KEY,
                chave VARCHAR(100) UNIQUE NOT NULL,
                valor TEXT NOT NULL,
                descricao TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Inserir configurações padrão
            INSERT INTO configuracoes_mapa (chave, valor, descricao) VALUES 
                ('mostrar_heatmap', 'true', 'Exibir camada de heatmap por padrão'),
                ('mostrar_markers', 'true', 'Exibir marcadores por padrão'),
                ('mostrar_pontos_estrategicos', 'true', 'Exibir pontos estratégicos por padrão'),
                ('zoom_inicial', '9', 'Nível de zoom inicial do mapa'),
                ('centro_lat', '-22.5', 'Latitude do centro inicial'),
                ('centro_lng', '-43.2', 'Longitude do centro inicial')
            ON CONFLICT (chave) DO NOTHING;
        `
    },
    {
        name: '005_indices_avancados',
        up: `
            -- Índice para filtro por partido
            CREATE INDEX IF NOT EXISTS idx_votos_partido ON votos_agregados (partido_sigla);
            
            -- Índice para filtro por bairro
            CREATE INDEX IF NOT EXISTS idx_locais_bairro ON locais_votacao (bairro);
            
            -- Índice para filtro por zona (extraída do id_tse)
            CREATE INDEX IF NOT EXISTS idx_locais_zona ON locais_votacao (SPLIT_PART(id_tse, '-', 2));
        `
    },
    {
        name: '006_admin_user_seed',
        up: `
            -- Criar usuário admin padrão (senha: admin123)
            -- Hash bcrypt para 'admin123': $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
            INSERT INTO usuarios (nome, email, senha_hash, role)
            VALUES ('Administrador', 'admin@mapaeleitoral.rj', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
            ON CONFLICT (email) DO NOTHING;
        `
    }
];

/**
 * Executa todas as migrations pendentes
 */
async function runMigrations() {
    console.log('🔄 Iniciando sistema de migrations...');

    try {
        // Criar tabela de controle
        await pool.query(createMigrationsTable);
        console.log('✅ Tabela de controle de migrations verificada');

        // Buscar migrations já executadas
        const result = await pool.query('SELECT name FROM _migrations');
        const executedMigrations = new Set(result.rows.map(r => r.name));

        // Executar migrations pendentes
        let migrationsExecuted = 0;

        for (const migration of migrations) {
            if (executedMigrations.has(migration.name)) {
                console.log(`⏭️  Migration ${migration.name} já executada`);
                continue;
            }

            console.log(`🚀 Executando migration: ${migration.name}`);

            try {
                // Executar migration
                await pool.query(migration.up);

                // Registrar migration como executada
                await pool.query(
                    'INSERT INTO _migrations (name) VALUES ($1)',
                    [migration.name]
                );

                console.log(`✅ Migration ${migration.name} executada com sucesso`);
                migrationsExecuted++;
            } catch (err) {
                console.error(`❌ Erro na migration ${migration.name}:`, err.message);
                // Continua para a próxima migration (algumas podem falhar se tabelas já existem)
            }
        }

        if (migrationsExecuted > 0) {
            console.log(`\n🎉 ${migrationsExecuted} migration(s) executada(s) com sucesso!`);
        } else {
            console.log('\n✅ Banco de dados já está atualizado');
        }

        return true;
    } catch (err) {
        console.error('❌ Erro ao executar migrations:', err.message);
        // Não lança erro para não impedir o servidor de iniciar
        return false;
    }
}

module.exports = { runMigrations };
