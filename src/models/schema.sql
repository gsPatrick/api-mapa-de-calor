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
    total_votos INTEGER DEFAULT 0
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

