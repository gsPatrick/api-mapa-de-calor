const pool = require('../../config/database');

class AdminService {
    // =====================================================
    // CRUD LOCAIS DE VOTAÇÃO
    // =====================================================

    /**
     * Lista todos os locais de votação com paginação
     */
    async getLocais(page = 1, limit = 50, search = '') {
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, id_tse, nome_local, endereco, bairro, cidade, latitude, longitude
            FROM locais_votacao
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (nome_local ILIKE $${paramIndex} OR bairro ILIKE $${paramIndex} OR cidade ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY nome_local LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Count total
        let countQuery = `SELECT COUNT(*) FROM locais_votacao WHERE 1=1`;
        const countParams = [];

        if (search) {
            countQuery += ` AND (nome_local ILIKE $1 OR bairro ILIKE $1 OR cidade ILIKE $1)`;
            countParams.push(`%${search}%`);
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return {
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Busca local por ID
     */
    async getLocalById(id) {
        const result = await pool.query(
            'SELECT * FROM locais_votacao WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Atualiza local de votação
     */
    async updateLocal(id, data) {
        const { nome_local, endereco, bairro, cidade, latitude, longitude } = data;

        const result = await pool.query(
            `UPDATE locais_votacao 
             SET nome_local = COALESCE($1, nome_local),
                 endereco = COALESCE($2, endereco),
                 bairro = COALESCE($3, bairro),
                 cidade = COALESCE($4, cidade),
                 latitude = COALESCE($5, latitude),
                 longitude = COALESCE($6, longitude)
             WHERE id = $7
             RETURNING *`,
            [nome_local, endereco, bairro, cidade, latitude, longitude, id]
        );

        return result.rows[0];
    }

    // =====================================================
    // CRUD PONTOS ESTRATÉGICOS
    // =====================================================

    /**
     * Lista todos os pontos estratégicos
     */
    async getPontos(apenasAtivos = true) {
        let query = `
            SELECT p.*, u.nome as criador_nome
            FROM pontos_estrategicos p
            LEFT JOIN usuarios u ON p.criado_por = u.id
        `;

        if (apenasAtivos) {
            query += ` WHERE p.ativo = true`;
        }

        query += ` ORDER BY p.created_at DESC`;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Busca ponto por ID
     */
    async getPontoById(id) {
        const result = await pool.query(
            `SELECT p.*, u.nome as criador_nome
             FROM pontos_estrategicos p
             LEFT JOIN usuarios u ON p.criado_por = u.id
             WHERE p.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Cria novo ponto estratégico
     */
    async createPonto(data, userId) {
        const { latitude, longitude, titulo, descricao, tipo_icone, cor } = data;

        const result = await pool.query(
            `INSERT INTO pontos_estrategicos 
             (latitude, longitude, titulo, descricao, tipo_icone, cor, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [latitude, longitude, titulo, descricao, tipo_icone || 'star', cor || '#FF5722', userId]
        );

        return result.rows[0];
    }

    /**
     * Atualiza ponto estratégico
     */
    async updatePonto(id, data) {
        const { latitude, longitude, titulo, descricao, tipo_icone, cor, ativo } = data;

        const result = await pool.query(
            `UPDATE pontos_estrategicos 
             SET latitude = COALESCE($1, latitude),
                 longitude = COALESCE($2, longitude),
                 titulo = COALESCE($3, titulo),
                 descricao = COALESCE($4, descricao),
                 tipo_icone = COALESCE($5, tipo_icone),
                 cor = COALESCE($6, cor),
                 ativo = COALESCE($7, ativo),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             RETURNING *`,
            [latitude, longitude, titulo, descricao, tipo_icone, cor, ativo, id]
        );

        return result.rows[0];
    }

    /**
     * Remove ponto estratégico (soft delete)
     */
    async deletePonto(id) {
        const result = await pool.query(
            `UPDATE pontos_estrategicos 
             SET ativo = false, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    }

    /**
     * Remove ponto estratégico permanentemente
     */
    async hardDeletePonto(id) {
        const result = await pool.query(
            'DELETE FROM pontos_estrategicos WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    // =====================================================
    // CONFIGURAÇÕES DO MAPA
    // =====================================================

    /**
     * Lista todas as configurações
     */
    async getConfiguracoes() {
        const result = await pool.query(
            'SELECT * FROM configuracoes_mapa ORDER BY chave'
        );

        // Converter para objeto chave-valor
        const config = {};
        result.rows.forEach(row => {
            config[row.chave] = row.valor;
        });

        return config;
    }

    /**
     * Atualiza configuração específica
     */
    async updateConfiguracao(chave, valor) {
        const result = await pool.query(
            `INSERT INTO configuracoes_mapa (chave, valor, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (chave) 
             DO UPDATE SET valor = $2, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [chave, valor]
        );
        return result.rows[0];
    }

    // =====================================================
    // ESTATÍSTICAS ADMIN
    // =====================================================

    /**
     * Retorna estatísticas gerais do sistema
     */
    async getAdminStats() {
        const queries = await Promise.all([
            pool.query('SELECT COUNT(*) FROM locais_votacao'),
            pool.query('SELECT COUNT(*) FROM votos_agregados'),
            pool.query('SELECT COUNT(*) FROM usuarios'),
            pool.query('SELECT COUNT(*) FROM pontos_estrategicos WHERE ativo = true'),
            pool.query('SELECT SUM(total_votos) FROM votos_agregados WHERE ano = 2022'),
            pool.query('SELECT SUM(total_votos) FROM votos_agregados WHERE ano = 2018')
        ]);

        return {
            total_locais: parseInt(queries[0].rows[0].count),
            total_registros_votos: parseInt(queries[1].rows[0].count),
            total_usuarios: parseInt(queries[2].rows[0].count),
            total_pontos_estrategicos: parseInt(queries[3].rows[0].count),
            total_votos_2022: parseInt(queries[4].rows[0].sum || 0),
            total_votos_2018: parseInt(queries[5].rows[0].sum || 0)
        };
    }
}

module.exports = new AdminService();
