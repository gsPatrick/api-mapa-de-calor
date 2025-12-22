const authService = require('../features/auth/auth.service');

/**
 * Middleware de autenticação JWT
 * Valida token no header Authorization e adiciona user ao request
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Obter token do header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: 'Token de autenticação não fornecido'
            });
        }

        // Formato esperado: "Bearer <token>"
        const parts = authHeader.split(' ');

        if (parts.length !== 2) {
            return res.status(401).json({
                error: 'Formato de token inválido'
            });
        }

        const [scheme, token] = parts;

        if (!/^Bearer$/i.test(scheme)) {
            return res.status(401).json({
                error: 'Token mal formatado'
            });
        }

        // Verificar e decodificar token
        const decoded = authService.verifyToken(token);

        // Adicionar dados do usuário ao request
        req.user = decoded;

        return next();
    } catch (error) {
        console.error('Erro na autenticação:', error.message);
        return res.status(401).json({
            error: 'Token inválido ou expirado'
        });
    }
};

/**
 * Middleware para verificar role do usuário
 * @param {string[]} roles - Array de roles permitidos
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Usuário não autenticado'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Acesso negado. Permissão insuficiente.'
            });
        }

        return next();
    };
};

/**
 * Middleware opcional de autenticação
 * Não bloqueia requisição, apenas adiciona user se token válido
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader) {
            const parts = authHeader.split(' ');

            if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
                const decoded = authService.verifyToken(parts[1]);
                req.user = decoded;
            }
        }
    } catch (error) {
        // Token inválido, continua sem usuário
        req.user = null;
    }

    return next();
};

module.exports = {
    authMiddleware,
    requireRole,
    optionalAuth
};
