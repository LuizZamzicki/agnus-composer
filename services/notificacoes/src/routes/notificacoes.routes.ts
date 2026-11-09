import { Router } from 'express';
import NotificacoesController from '../controllers/notificacoes.controller';
import authenticateToken from '@agnus/comum/middlewares/auth.middleware';

// Avisos ao cliente: a rota fixa vem antes da que recebe :id.
const router = Router();

router.get('/notifications/me', authenticateToken, NotificacoesController.findMine);
router.patch('/notifications/read-all', authenticateToken, NotificacoesController.markAllAsRead);
router.patch('/notifications/:id/read', authenticateToken, NotificacoesController.markAsRead);

export default router;
