-- Tabela de Locais de Votação (Escolas)
CREATE TABLE IF NOT EXISTS locais_votacao (
    id SERIAL PRIMARY KEY,
    id_tse VARCHAR(50) UNIQUE NOT NULL, -- Chave composta: CD_MUNICIPIO-NR_ZONA-NR_LOCAL
    nome_local VARCHAR(255) NOT NULL,
    endereco TEXT,
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6)
);

-- Tabela de Votos Agregados (Desnormalizada)
CREATE TABLE IF NOT EXISTS votos_agregados (
    id SERIAL PRIMARY KEY,
    ano INTEGER DEFAULT 2022,
    cargo VARCHAR(50), -- Presidente, Governador, etc.
    candidato_nome VARCHAR(255),
    candidato_numero VARCHAR(20),
    partido_sigla VARCHAR(20),
    local_id INTEGER REFERENCES locais_votacao(id),
    total_votos INTEGER DEFAULT 0,
    UNIQUE (ano, cargo, candidato_numero, local_id)
);

-- Índices para alta performance
CREATE INDEX IF NOT EXISTS idx_votos_candidato_numero ON votos_agregados (candidato_numero);
CREATE INDEX IF NOT EXISTS idx_votos_cargo ON votos_agregados (cargo);
CREATE INDEX IF NOT EXISTS idx_votos_local_id ON votos_agregados (local_id);
-- Índice composto para queries de mapa (cargo + numero)
CREATE INDEX IF NOT EXISTS idx_votos_cargo_numero ON votos_agregados (cargo, candidato_numero);
-- Índice para filtrar por ano de eleição (2018, 2022)
CREATE INDEX IF NOT EXISTS idx_votos_ano ON votos_agregados (ano);
-- Índice composto incluindo ano para queries do mapa
CREATE INDEX IF NOT EXISTS idx_votos_ano_cargo_numero ON votos_agregados (ano, cargo, candidato_numero);

-- =====================================================
-- NOVAS TABELAS - Sistema de Inteligência Política
-- =====================================================

-- Tabela de Usuários (Autenticação JWT)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer', -- viewer, editor, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Pontos Estratégicos (Marcadores customizados no mapa)
CREATE TABLE IF NOT EXISTS pontos_estrategicos (
    id SERIAL PRIMARY KEY,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    tipo_icone VARCHAR(50) DEFAULT 'star', -- star, flag, pin, alert, target
    cor VARCHAR(20) DEFAULT '#FF5722',
    ativo BOOLEAN DEFAULT true,
    criado_por INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configurações do Mapa
CREATE TABLE IF NOT EXISTS configuracoes_mapa (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT,
    descricao TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configurações padrão
INSERT INTO configuracoes_mapa (chave, valor, descricao) VALUES 
    ('mostrar_heatmap', 'true', 'Exibir camada de calor por padrão'),
    ('mostrar_clusters', 'true', 'Exibir clusters de marcadores'),
    ('mostrar_pontos_estrategicos', 'true', 'Exibir pontos estratégicos'),
    ('camada_padrao', 'streets', 'Camada de mapa padrão (streets, satellite, dark)')
ON CONFLICT (chave) DO NOTHING;

-- =====================================================
-- ÍNDICES ADICIONAIS PARA NOVOS FILTROS
-- =====================================================

-- Índice para filtro por partido
CREATE INDEX IF NOT EXISTS idx_votos_partido ON votos_agregados (partido_sigla);

-- Índice para filtro por bairro
CREATE INDEX IF NOT EXISTS idx_locais_bairro ON locais_votacao (bairro);

-- Índice para filtro por zona (extraída do id_tse)
CREATE INDEX IF NOT EXISTS idx_locais_zona ON locais_votacao (SPLIT_PART(id_tse, '-', 2));

-- Índice para usuários por email (login)
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);

-- Índice para pontos estratégicos por criador
CREATE INDEX IF NOT EXISTS idx_pontos_criado_por ON pontos_estrategicos (criado_por);

-- Índice para pontos estratégicos ativos
CREATE INDEX IF NOT EXISTS idx_pontos_ativos ON pontos_estrategicos (ativo) WHERE ativo = true;

