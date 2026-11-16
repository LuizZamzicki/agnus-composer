import { Router } from 'express';
import NotificacoesController from '../controllers/notificacoes.controller';
import authenticateToken, { authorizeRoles } from '@agnus/comum/middlewares/auth.middleware';
import RegistroService from '../registro/registro.service';

// Avisos ao cliente: a rota fixa vem antes da que recebe :id.
const router = Router();

router.get('/notifications/me', authenticateToken, NotificacoesController.findMine);
// Registro de eventos (vendas, e-mails, avisos, devoluções...): só a equipe.
router.get('/notifications/registro', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await RegistroService.listar(req.query as Record<string, unknown>));
});
router.patch('/notifications/read-all', authenticateToken, NotificacoesController.markAllAsRead);
router.patch('/notifications/:id/read', authenticateToken, NotificacoesController.markAsRead);

export default router;
