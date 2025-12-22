const authService = require('./auth.service');

class AuthController {
    /**
     * POST /api/auth/register
     * Registra novo usuário
     * Body: { nome, email, senha, role? }
     */
    async register(req, res) {
        try {
            const { nome, email, senha, role } = req.body;

            if (!nome || !email || !senha) {
                return res.status(400).json({
                    error: 'Nome, email e senha são obrigatórios'
                });
            }

            // Validar email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Email inválido' });
            }

            // Validar senha (mínimo 6 caracteres)
            if (senha.length < 6) {
                return res.status(400).json({
                    error: 'Senha deve ter no mínimo 6 caracteres'
                });
            }

            const result = await authService.register(nome, email, senha, role);

            res.status(201).json({
                message: 'Usuário criado com sucesso',
                ...result
            });
        } catch (error) {
            console.error('Erro no registro:', error);

            if (error.message === 'Email já cadastrado') {
                return res.status(409).json({ error: error.message });
            }

            res.status(500).json({ error: 'Erro ao registrar usuário' });
        }
    }

    /**
     * POST /api/auth/login
     * Autentica usuário
     * Body: { email, senha }
     */
    async login(req, res) {
        try {
            const { email, senha } = req.body;

            if (!email || !senha) {
                return res.status(400).json({
                    error: 'Email e senha são obrigatórios'
                });
            }

            const result = await authService.login(email, senha);

            res.json({
                message: 'Login realizado com sucesso',
                ...result
            });
        } catch (error) {
            console.error('Erro no login:', error);

            if (error.message === 'Credenciais inválidas') {
                return res.status(401).json({ error: error.message });
            }

            res.status(500).json({ error: 'Erro ao realizar login' });
        }
    }

    /**
     * GET /api/auth/me
     * Retorna dados do usuário autenticado
     * Requer: Token JWT no header Authorization
     */
    async me(req, res) {
        try {
            // req.user é definido pelo middleware de autenticação
            const user = await authService.getUserById(req.user.id);

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            res.json(user);
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
        }
    }

    /**
     * PUT /api/auth/profile
     * Atualiza perfil do usuário autenticado
     * Body: { nome?, email? }
     */
    async updateProfile(req, res) {
        try {
            const { nome, email } = req.body;

            const user = await authService.updateProfile(req.user.id, { nome, email });

            res.json({
                message: 'Perfil atualizado com sucesso',
                user
            });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            res.status(500).json({ error: 'Erro ao atualizar perfil' });
        }
    }

    /**
     * PUT /api/auth/password
     * Altera senha do usuário autenticado
     * Body: { senhaAtual, novaSenha }
     */
    async changePassword(req, res) {
        try {
            const { senhaAtual, novaSenha } = req.body;

            if (!senhaAtual || !novaSenha) {
                return res.status(400).json({
                    error: 'Senha atual e nova senha são obrigatórias'
                });
            }

            if (novaSenha.length < 6) {
                return res.status(400).json({
                    error: 'Nova senha deve ter no mínimo 6 caracteres'
                });
            }

            await authService.changePassword(req.user.id, senhaAtual, novaSenha);

            res.json({ message: 'Senha alterada com sucesso' });
        } catch (error) {
            console.error('Erro ao alterar senha:', error);

            if (error.message === 'Senha atual incorreta') {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: 'Erro ao alterar senha' });
        }
    }

    /**
     * POST /api/auth/verify
     * Verifica se token JWT é válido
     * Body: { token }
     */
    async verifyToken(req, res) {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: 'Token é obrigatório' });
            }

            const decoded = authService.verifyToken(token);

            res.json({ valid: true, user: decoded });
        } catch (error) {
            res.json({ valid: false, error: error.message });
        }
    }
}

module.exports = new AuthController();
