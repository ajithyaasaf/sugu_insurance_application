import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import leadRoutes from './modules/lead/lead.routes';
import customerRoutes from './modules/customer/customer.routes';
import companyRoutes from './modules/company/company.routes';
import policyRoutes from './modules/policy/policy.routes';
import paymentRoutes from './modules/payment/payment.routes';
import claimRoutes from './modules/claim/claim.routes';
import followUpRoutes from './modules/followup/followup.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import searchRoutes from './modules/search/search.routes';
import dealerRoutes from './modules/dealer/dealer.routes';
import reportRoutes from './modules/report/report.routes';
import commissionRoutes from './modules/commission/commission.routes';
import activityRoutes from './modules/activity/activity.routes';
import offerRoutes from './modules/offer/offer.routes';
import { initCronJobs } from './utils/cron';
import prisma from './utils/prisma';


const app = express();
app.set('trust proxy', 1);

// ─── Middleware ──────────────────────────────────────────
app.use(
    cors({
        origin: env.CLIENT_URL,
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

// ─── Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/follow-ups', followUpRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/offers', offerRoutes);

// ─── Health & Keep-Alive ────────────────────────────────
/**
 * @description Robust health check for monitoring systems
 */
app.get('/api/health', async (_req, res) => {
    try {
        // Perform a simple query to ensure DB is responsive
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'degraded',
            database: 'disconnected',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * @description Lightweight ping endpoint for UptimeRobot (minimal latency)
 */
app.get('/ping', (_req, res) => {
    res.status(200).send('pong');
});


// ─── Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ─── Initialize Background Jobs ─────────────────────────
initCronJobs();

// ─── Start Server ───────────────────────────────────────
app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📊 Environment: ${env.NODE_ENV}`);
});

export default app;