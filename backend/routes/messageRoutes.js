import express from 'express';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  votePoll
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/:chatId', getMessages);
router.post('/', upload.single('file'), sendMessage);
router.put('/:id', editMessage);
router.delete('/:id', deleteMessage);
router.post('/react/:id', reactToMessage);
router.post('/vote/:id', votePoll);

export default router;
