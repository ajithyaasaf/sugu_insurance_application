import prisma from '../../utils/prisma';

export interface LogActivityParams {
    userId: string;
    userRole?: string;
    action: string;      // e.g., 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'CONVERT', 'LOGIN', 'EXPORT'
    entityType: string;  // e.g., 'lead', 'customer', 'policy', 'payment', 'claim', 'followup', 'dealer', 'commission', 'auth'
    entityId?: string;
    title: string;
    description?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

export class ActivityService {
    /**
     * Async non-blocking logger function
     */
    static async logActivity(params: LogActivityParams) {
        try {
            if (!params.userId) return;
            // ONLY log activities for staff members (admins/owners)
            if (params.userRole !== 'staff') return;

            await prisma.activityLog.create({
                data: {
                    userId: params.userId,
                    userRole: params.userRole,
                    action: params.action,
                    entityType: params.entityType,
                    entityId: params.entityId || null,
                    title: params.title,
                    description: params.description || null,
                    metadata: params.metadata ? params.metadata : undefined,
                    ipAddress: params.ipAddress || null,
                    userAgent: params.userAgent || null,
                },
            });
        } catch (err) {
            console.error('[ActivityLogger] Error recording activity:', err);
        }
    }

    async getActivities(userId: string, role: string, query: any) {
        const page = parseInt(query.page as string, 10) || 1;
        const limit = Math.min(parseInt(query.limit as string, 10) || 20, 100);
        const skip = (page - 1) * limit;

        const { search, entityType, action, startDate, endDate, agentId } = query;

        // Since only staff activities are logged, agents view all logged activities
        const where: any = {};
        
        if (agentId && agentId !== 'all') {
            where.userId = agentId;
        }

        if (entityType && entityType !== 'all') {
            where.entityType = entityType;
        }

        if (action && action !== 'all') {
            where.action = action;
        }

        // Date range filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const start = new Date(startDate as string);
                start.setHours(0, 0, 0, 0);
                where.createdAt.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        // Search text
        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
                { entityType: { contains: search as string, mode: 'insensitive' } },
                { action: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.activityLog.count({ where }),
        ]);

        return {
            data: items,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    async getSummary(userId: string, role: string) {
        const where: any = {};

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [todayCount, weeklyCount, monthCount, categoryStats, usersList] = await Promise.all([
            prisma.activityLog.count({
                where: { ...where, createdAt: { gte: startOfToday } },
            }),
            prisma.activityLog.count({
                where: { ...where, createdAt: { gte: sevenDaysAgo } },
            }),
            prisma.activityLog.count({
                where: { ...where, createdAt: { gte: startOfMonth } },
            }),
            prisma.activityLog.groupBy({
                by: ['entityType'],
                where,
                _count: { _all: true },
            }),
            prisma.user.findMany({
                select: { id: true, name: true, email: true, role: true },
                orderBy: { name: 'asc' },
            }),
        ]);

        return {
            todayCount,
            weeklyCount,
            monthCount,
            categoryDistribution: categoryStats.map((c: any) => ({
                category: c.entityType,
                count: c._count._all,
            })),
            users: usersList,
        };
    }
}
