import { Router } from 'express';
import UsuarioContatosController from '../controllers/usuarioContatos.controller';
import UsuarioEnderecosController from '../controllers/usuarioEnderecos.controller';
import authenticateToken, { authorizeSelfOrAdmin } from '../middlewares/auth.middleware';
import { authorizeOwnerByBody, authorizeOwnerByParam, OWNERS } from '../middlewares/ownership.middleware';

// Bounded context Clientes: enderecos de entrega e contatos, sempre do proprio usuario.
const router = Router();

router.post('/user-addresses', authenticateToken, authorizeOwnerByBody('id_usuario'), UsuarioEnderecosController.create);
router.get('/user-addresses/:id_user', authenticateToken, authorizeSelfOrAdmin('id_user'), UsuarioEnderecosController.getByIdUser);
router.put('/user-addresses/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.endereco), authorizeOwnerByBody('id_usuario'), UsuarioEnderecosController.update);
router.delete('/user-addresses/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.endereco), UsuarioEnderecosController.remove);

router.post('/user-contacts', authenticateToken, authorizeOwnerByBody('id_usuario'), UsuarioContatosController.create);
router.get('/user-contacts/:id_user', authenticateToken, authorizeSelfOrAdmin('id_user'), UsuarioContatosController.getByIdUser);
router.put('/user-contacts/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.contato), authorizeOwnerByBody('id_usuario'), UsuarioContatosController.update);
router.delete('/user-contacts/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.contato), UsuarioContatosController.remove);

export default router;
