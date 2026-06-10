import express from 'express';
import {
  getBroadcasts,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  sendBroadcastMessage
} from '../controllers/broadcastController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getBroadcasts);
router.post('/', createBroadcast);
router.put('/:id', updateBroadcast);
router.delete('/:id', deleteBroadcast);
router.post('/:id/send', sendBroadcastMessage);

export default router;
