import express from 'express';
import {
  getChats,
  accessChat,
  togglePinChat,
  toggleArchiveChat,
  muteChat
} from '../controllers/chatController.js';
import {
  createGroup,
  addGroupMembers,
  removeGroupMember,
  promoteToAdmin,
  joinGroupViaInvite,
  updateGroupSettings
} from '../controllers/groupController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

// 1-on-1 Chats and general chat listings
router.get('/', getChats);
router.post('/', accessChat);
router.post('/pin/:id', togglePinChat);
router.post('/archive/:id', toggleArchiveChat);
router.post('/mute/:id', muteChat);

// Group Chats
router.post('/group', upload.single('groupAvatar'), createGroup);
router.put('/group/:id/add', addGroupMembers);
router.put('/group/:id/remove', removeGroupMember);
router.put('/group/:id/promote', promoteToAdmin);
router.get('/group/invite/:code', joinGroupViaInvite);
router.put('/group/:id/settings', upload.single('groupAvatar'), updateGroupSettings);

export default router;
