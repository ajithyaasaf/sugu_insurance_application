import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimit';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema } from './auth.schema';
import { authenticate } from '../../middleware/auth';

const router = Router();



if (process.env.ENABLE_SIGNUP === 'true') {
    router.post('/register', authLimiter, validate(registerSchema), (req, res, next) =>
        authController.register(req, res, next)
    );
}
router.post('/login', authLimiter, validate(loginSchema), (req, res, next) =>
    authController.login(req, res, next)
);
router.post('/refresh', (req, res, next) =>
    authController.refresh(req, res, next)
);
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));
router.get('/me', authenticate, (req, res, next) =>
    authController.me(req, res, next)
);

export default router;
