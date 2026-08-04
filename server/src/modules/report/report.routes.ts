import { Router } from 'express';
import { reportController } from './report.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { reportGenerateSchema, reportExportSchema } from './report.schema';

const router = Router();
router.use(authenticate);

router.post('/generate',  authorize(['agent']), validate(reportGenerateSchema), (req, res, next) => reportController.generate(req, res, next));
router.get('/dashboard',  authorize(['agent', 'staff']), (req, res, next) => reportController.dashboard(req, res, next));
router.get('/financial-years', authorize(['agent']), (req, res, next) => reportController.financialYears(req, res, next));
router.post('/export',    authorize(['agent']), validate(reportExportSchema),   (req, res, next) => reportController.exportReport(req, res, next));

export default router;
