const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret key para JWT (em produção, usar variável de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'mapa-eleitoral-rj-secret-key-2024';
const JWT_EXPIRES_IN = '7d'; // Token válido por 7 dias

class AuthService {
    /**
     * Registra um novo usuário
     * @param {string} nome - Nome do usuário
     * @param {string} email - Email único
     * @param {string} senha - Senha em texto plano
     * @param {string} role - Papel do usuário (viewer, editor, admin)
     */
    async register(nome, email, senha, role = 'viewer') {
        // Verificar se email já existe
        const existingUser = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('Email já cadastrado');
        }

        // Hash da senha com bcrypt (salt rounds = 10)
        const senhaHash = await bcrypt.hash(senha, 10);

        // Inserir usuário
        const result = await pool.query(
            `INSERT INTO usuarios (nome, email, senha_hash, role) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, nome, email, role, created_at`,
            [nome, email, senhaHash, role]
        );

        const user = result.rows[0];

        // Gerar token JWT
        const token = this.generateToken(user);

        return {
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role
            },
            token
        };
    }

    /**
     * Autentica usuário e retorna token JWT
     * @param {string} email - Email do usuário
     * @param {string} senha - Senha em texto plano
     */
    async login(email, senha) {
        // Buscar usuário por email
        const result = await pool.query(
            'SELECT id, nome, email, senha_hash, role FROM usuarios WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error('Credenciais inválidas');
        }

        const user = result.rows[0];

        // Verificar senha com bcrypt
        const senhaValida = await bcrypt.compare(senha, user.senha_hash);

        if (!senhaValida) {
            throw new Error('Credenciais inválidas');
        }

        // Gerar token JWT
        const token = this.generateToken(user);

        return {
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role
            },
            token
        };
    }

    /**
     * Gera token JWT para o usuário
     */
    generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    /**
     * Verifica e decodifica token JWT
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Token inválido ou expirado');
        }
    }

    /**
     * Busca usuário por ID
     */
    async getUserById(id) {
        const result = await pool.query(
            'SELECT id, nome, email, role, created_at FROM usuarios WHERE id = $1',
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Atualiza perfil do usuário
     */
    async updateProfile(id, data) {
        const { nome, email } = data;

        const result = await pool.query(
            `UPDATE usuarios 
             SET nome = COALESCE($1, nome), 
                 email = COALESCE($2, email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, nome, email, role`,
            [nome, email, id]
        );

        return result.rows[0];
    }

    /**
     * Altera senha do usuário
     */
    async changePassword(id, senhaAtual, novaSenha) {
        // Buscar usuário
        const result = await pool.query(
            'SELECT senha_hash FROM usuarios WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            throw new Error('Usuário não encontrado');
        }

        // Verificar senha atual
        const senhaValida = await bcrypt.compare(senhaAtual, result.rows[0].senha_hash);

        if (!senhaValida) {
            throw new Error('Senha atual incorreta');
        }

        // Hash da nova senha
        const novoHash = await bcrypt.hash(novaSenha, 10);

        // Atualizar senha
        await pool.query(
            'UPDATE usuarios SET senha_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [novoHash, id]
        );

        return { success: true };
    }
}

module.exports = new AuthService();
