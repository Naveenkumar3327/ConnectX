import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  updatePrivacySettings,
  searchUsers,
  blockToggleUser,
  getUserByUsername
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

router.get('/profile', getUserProfile);
router.put('/profile', upload.single('profilePicture'), updateUserProfile);
router.put('/privacy', updatePrivacySettings);
router.get('/search', searchUsers);
router.post('/block', blockToggleUser);
router.get('/:username', getUserByUsername);

export default router;
