import { Router } from 'express';
import { paymentController } from './payment.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createPaymentSchema, updatePaymentSchema, batchCollectSchema } from './payment.schema';

const router = Router();
router.use(authenticate);

// Batch Collection Endpoints (defined before /:id to avoid route collision)
router.get('/unsettled-payers', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.getUnsettledPayers(req, res, next));
router.get('/unsettled-by-payer', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.getUnsettledByPayer(req, res, next));
router.post('/batch-collect', authorize(['agent', 'admin', 'staff']), validate(batchCollectSchema), (req, res, next) => paymentController.createBatchCollection(req, res, next));
router.get('/batches', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.getBatches(req, res, next));
router.get('/batches/:id', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.getBatchById(req, res, next));

router.post('/', authorize(['agent', 'admin', 'staff']), validate(createPaymentSchema), (req, res, next) => paymentController.create(req, res, next));
router.get('/', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.findAll(req, res, next));
router.post('/detect-overdue', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.detectOverdue(req, res, next));
router.get('/:id', authorize(['agent', 'admin', 'staff']), (req, res, next) => paymentController.findById(req, res, next));
router.put('/:id', authorize(['agent', 'admin', 'staff']), validate(updatePaymentSchema), (req, res, next) => paymentController.update(req, res, next));
router.delete('/:id', authorize(['agent', 'admin']), (req, res, next) => paymentController.delete(req, res, next));

export default router;
