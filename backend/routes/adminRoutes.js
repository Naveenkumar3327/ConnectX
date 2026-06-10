import express from 'express';
import {
  getAnalytics,
  getUsersList,
  suspendUserToggle,
  getReportsList,
  resolveReport
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Guard entire router for authenticated administrators
router.use(protect);
router.use(admin);

router.get('/analytics', getAnalytics);
router.get('/users', getUsersList);
router.put('/users/:id/suspend', suspendUserToggle);
router.get('/reports', getReportsList);
router.put('/reports/:id/resolve', resolveReport);

export default router;
