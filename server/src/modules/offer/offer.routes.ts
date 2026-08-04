import { Router } from 'express';
import { offerController } from './offer.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { attachOfferSchema, updateOfferSchema } from './offer.schema';

const router = Router();
router.use(authenticate);

router.get('/summary', (req, res, next) => offerController.getSummary(req, res, next));
router.get('/', (req, res, next) => offerController.findAll(req, res, next));
router.get('/:id', (req, res, next) => offerController.findById(req, res, next));
router.post('/', validate(attachOfferSchema), (req, res, next) => offerController.attach(req, res, next));
router.put('/:id', validate(updateOfferSchema), (req, res, next) => offerController.update(req, res, next));
router.delete('/:id', (req, res, next) => offerController.remove(req, res, next));

export default router;
