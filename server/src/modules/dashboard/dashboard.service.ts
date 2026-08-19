import prisma from '../../utils/prisma';
import { buildStatusFilter, getStartOfTodayIST, mapPolicyStatus } from '../../utils/date';
import { ownerFilter } from '../../utils/rbac';

export class DashboardService {
    async getSummary(userId: string, role: string) {
        const ow = ownerFilter(userId, role); // e.g. {} for staff, { userId } for agents
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const todayStart = getStartOfTodayIST();
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        const sevenDaysFromNow = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        const results = await Promise.all([
            // 0: Policies expiring in next 30 days (OD or TP)
            prisma.policy.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    status: 'active',
                    OR: [
                        { expiryDate: { gte: todayStart, lte: thirtyDaysFromNow } },
                        { tpEndDate: { gte: todayStart, lte: thirtyDaysFromNow } }
                    ]
                } as any,
                include: { customer: true, company: true },
                orderBy: { expiryDate: 'asc' },
                take: 10,
            }),
            // 1: Count of expiring policies
            prisma.policy.count({
                where: {
                    ...ow,
                    deletedAt: null,
                    status: 'active',
                    OR: [
                        { expiryDate: { gte: todayStart, lte: thirtyDaysFromNow } },
                        { tpEndDate: { gte: todayStart, lte: thirtyDaysFromNow } }
                    ]
                } as any,
            }),

            // 2: Overdue + Upcoming 7 Days follow-ups
            prisma.followUp.findMany({
                where: {
                    ...ow,
                    status: 'pending',
                    nextFollowUpDate: { lte: sevenDaysFromNow },
                },
                include: { customer: true, policy: true },
                orderBy: { nextFollowUpDate: 'asc' },
                take: 10,
            }),
            // 3: Count of overdue + today's follow-ups
            prisma.followUp.count({
                where: {
                    ...ow,
                    status: 'pending',
                    nextFollowUpDate: { lt: todayEnd },
                },
            }),

            // 4: Pending payments (now representing future/upcoming payments)
            prisma.payment.findMany({
                where: {
                    ...ow,
                    status: { in: ['pending', 'partial'] },
                    dueDate: { gte: getStartOfTodayIST() }
                },
                include: { customer: true, policy: true },
                orderBy: { dueDate: 'asc' },
                take: 10,
            }),
            // 5: Count pending payments
            prisma.payment.count({
                where: {
                    ...ow,
                    status: { in: ['pending', 'partial'] },
                    dueDate: { gte: getStartOfTodayIST() }
                }
            }),

            // 6: Overdue payments
            prisma.payment.findMany({
                where: {
                    ...ow,
                    status: { in: ['pending', 'partial'] },
                    dueDate: { lt: getStartOfTodayIST() }
                },
                include: { customer: true, policy: true },
                orderBy: { dueDate: 'asc' },
                take: 10,
            }),
            // 7: Count overdue payments
            prisma.payment.count({
                where: {
                    ...ow,
                    status: { in: ['pending', 'partial'] },
                    dueDate: { lt: getStartOfTodayIST() }
                }
            }),

            // 8: Total Customers
            prisma.customer.count({ where: { ...ow, deletedAt: null } }),
            // 9: Total Active Policies
            prisma.policy.count({ where: { ...ow, deletedAt: null, ...buildStatusFilter('active') } as any }),
            // 10: Total Leads
            prisma.lead.count({ where: { ...ow, deletedAt: null, status: { not: 'converted' } } }),

            // 11: Active claims (open/unsettled claims)
            prisma.claim.findMany({
                where: { ...ow, status: { in: ['filed', 'approved'] } },
                include: { customer: true, policy: { include: { company: true } } },
                orderBy: { createdAt: 'desc' },
                take: 15,
            }),

            // 12: Company stats (grouped by company)
            prisma.policy.groupBy({
                by: ['companyId'],
                where: { ...ow, deletedAt: null, ...buildStatusFilter('active') } as any,
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            }),

            // 13: Overdue + Upcoming 7 Days lead follow-ups
            prisma.lead.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    status: { not: 'converted' },
                    nextFollowUpDate: { lte: sevenDaysFromNow },
                },
                orderBy: { nextFollowUpDate: 'asc' },
                take: 10,
            }),
            // 14: Count overdue + today's lead follow-ups
            prisma.lead.count({
                where: {
                    ...ow,
                    deletedAt: null,
                    status: { not: 'converted' },
                    nextFollowUpDate: { lt: todayEnd },
                },
            }),

            // 15: Birthday candidates (filtered in JS for cross-DB compatibility)
            prisma.customer.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    dob: { not: null },
                },
                select: { id: true, name: true, phone: true, dob: true },
            }),

            // 16: Vehicle Class stats (distribution)
            prisma.policy.groupBy({
                by: ['vehicleClass'],
                where: { ...ow, deletedAt: null, ...buildStatusFilter('active') } as any,
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            }),
            // 17: Recently expired policies
            prisma.policy.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    ...buildStatusFilter('expired'),
                    renewals: { none: { deletedAt: null } },
                } as any,
                include: { customer: true, company: true },
                orderBy: { expiryDate: 'desc' },
                take: 10,
            }),
            // 18: Count of expired policies
            prisma.policy.count({
                where: {
                    ...ow,
                    deletedAt: null,
                    ...buildStatusFilter('expired'),
                    renewals: { none: { deletedAt: null } },
                } as any,
            }),
            // 19: Count of filed claims
            prisma.claim.count({
                where: { ...ow, status: 'filed' },
            }),
            // 20: Count of approved claims
            prisma.claim.count({
                where: { ...ow, status: 'approved' },
            }),
        ]);

        const expiringPolicies = results[0] as any[];
        const expiringPoliciesCount = results[1] as number;
        const todayFollowUps = results[2] as any[];
        const todayFollowUpsCount = results[3] as number;
        const pendingPayments = results[4] as any[];
        const pendingPaymentsCount = results[5] as number;
        const overduePayments = results[6] as any[];
        const overduePaymentsCount = results[7] as number;
        const totalCustomers = results[8] as number;
        const totalActivePolicies = results[9] as number;
        const totalLeads = results[10] as number;
        const recentClaims = results[11] as any[];
        const companyGrouping = results[12] as any[];
        const todayLeadFollowUps = results[13] as any[];
        const todayLeadFollowUpsCount = results[14] as number;
        const allBirthdayCandidates = results[15] as any[];
        const vehicleClassGrouping = results[16] as any[];
        const expiredPolicies = results[17] as any[];
        const expiredPoliciesCount = results[18] as number;
        const filedClaimsCount = results[19] as number;
        const approvedClaimsCount = results[20] as number;

        // Get current month and date in IST (0-indexed month)
        const istParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            month: 'numeric',
            day: 'numeric'
        }).formatToParts(now);
        
        const todayMonth = parseInt(istParts.find(p => p.type === 'month')?.value || '1') - 1; // 0-indexed
        const todayDay = parseInt(istParts.find(p => p.type === 'day')?.value || '1');

        const todayBirthdays = allBirthdayCandidates.filter(c => {
            if (!c.dob) return false;
            const d = new Date(c.dob);
            const dobParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                month: 'numeric',
                day: 'numeric'
            }).formatToParts(d);
            const dobMonth = parseInt(dobParts.find(p => p.type === 'month')?.value || '1') - 1;
            const dobDay = parseInt(dobParts.find(p => p.type === 'day')?.value || '1');
            return dobMonth === todayMonth && dobDay === todayDay;
        });

        // Merge policy follow-ups and lead follow-ups into a single sorted list
        const combinedFollowUps = [
            ...todayFollowUps.map(f => ({ ...f, type: 'followup' })),
            ...todayLeadFollowUps.map(l => ({ ...l, type: 'lead', customer: { name: l.name } }))
        ].sort((a: any, b: any) =>
            new Date(a.nextFollowUpDate!).getTime() - new Date(b.nextFollowUpDate!).getTime()
        ).slice(0, 10);

        const combinedFollowUpsCount = todayFollowUpsCount + todayLeadFollowUpsCount;

        // Fetch company names for the groupBy results
        const companyIds = companyGrouping.map((s: any) => s.companyId);
        const companies = await prisma.company.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, name: true }
        });

        const companyStats = companyGrouping.map((s: any) => {
            const company = companies.find((c) => c.id === s.companyId);
            return {
                companyId: s.companyId,
                companyName: company?.name || 'Unknown',
                count: s._count._all,
                totalPremium: s._sum.totalPremium || s._sum.premiumAmount || 0,
            };
        });

        const vehicleClassStats = vehicleClassGrouping.map((s: any) => ({
            vehicleClass: s.vehicleClass || 'UNSPECIFIED',
            count: s._count._all,
            totalPremium: s._sum.totalPremium || s._sum.premiumAmount || 0,
        }));

        return {
            stats: {
                totalCustomers,
                totalActivePolicies,
                totalLeads,
                expiringPoliciesCount,
                todayFollowUpsCount: combinedFollowUpsCount,
                pendingPaymentsCount,
                overduePaymentsCount,
                todayBirthdaysCount: todayBirthdays.length,
                expiredPoliciesCount,
                filedClaimsCount,
                approvedClaimsCount,
                activeClaimsCount: filedClaimsCount + approvedClaimsCount,
            },
            expiringPolicies: expiringPolicies.map(mapPolicyStatus),
            expiredPolicies: expiredPolicies.map(mapPolicyStatus),
            todayFollowUps: combinedFollowUps,
            pendingPayments,
            overduePayments,
            recentClaims,
            activeClaims: recentClaims,
            companyStats,
            vehicleClassStats,
            todayBirthdays,
        };
    }
}

export const dashboardService = new DashboardService();
