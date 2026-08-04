import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { ActivityController } from './activity.controller';

const router = Router();
const controller = new ActivityController();

router.use(authenticate);

router.get('/', (req, res) => controller.getActivities(req, res));
router.get('/summary', (req, res) => controller.getSummary(req, res));
router.get('/export', (req, res) => controller.exportActivities(req, res));

export default router;
