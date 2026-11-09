import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import UsersController from '../controllers/usuarios.controller';
import { PERMISSIONS } from '../config/permissions';
import authenticateToken, { authorizeSelfOrAdmin } from '../middlewares/auth.middleware';
import { checarPermissao } from '../middlewares/permission.middleware';
import { limitarCadastro, limitarLogin } from '../middlewares/rateLimit.middleware';

// Bounded context Identidade e Acesso: cadastro, login (senha e Google) e conta do usuario.
const router = Router();

router.post('/users', limitarCadastro, UsersController.create);
router.get('/users', authenticateToken, checarPermissao(PERMISSIONS.USUARIO_LISTAR), UsersController.findAll);
router.get('/users/:id', authenticateToken, authorizeSelfOrAdmin('id'), UsersController.getById);
router.delete('/users/:id', authenticateToken, checarPermissao(PERMISSIONS.USUARIO_EXCLUIR), UsersController.remove);
router.put('/users/:id', authenticateToken, authorizeSelfOrAdmin('id'), UsersController.update);
router.patch('/users/:id/password', authenticateToken, authorizeSelfOrAdmin('id'), UsersController.updatePassword);

router.post('/auth/login', limitarLogin, AuthController.login);
router.get('/auth/me', authenticateToken, AuthController.me);
router.get('/auth/google', AuthController.googleStart);
router.get('/auth/google/callback', AuthController.googleCallback);

export default router;
