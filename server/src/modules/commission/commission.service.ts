import prisma from '../../utils/prisma';
import { getStartOfDayIST, getEndOfDayIST } from '../../utils/date';
import { CommissionPreviewInput, CommissionCreateInput, CommissionUpdateInput, CommissionBulkUpdateInput } from './commission.schema';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

export class CommissionService {
    /**
     * Get an overview of pending (unprocessed) commissions grouped by dealer.
     * Helpful for UX so admins know who needs to be paid without guessing.
     */
    async getPending(userId: string, role: string) {
        // Find all active policies that are NOT yet tied to any commission
        const unprocessedPolicies = await prisma.policy.findMany({
            where: {
                ...ownerFilter(userId, role),
                deletedAt: null,
                dealerId: { not: null },
                status: { in: ['active', 'expired'] }, // EXCLUDE CANCELLED
                commissionPolicies: { none: {} }
            },
            select: {
                dealerId: true,
                companyId: true,
                startDate: true,
                company: { select: { name: true } }
            },
            orderBy: { startDate: 'asc' } // Earliest first
        });

        const groupingMap = new Map<string, { dealerId: string; companyIds: Set<string>; companyNames: Set<string>; count: number; oldestDate: Date; newestDate: Date }>();
        for (const p of unprocessedPolicies) {
            const key = p.dealerId!;
            if (!groupingMap.has(key)) {
                groupingMap.set(key, {
                    dealerId: key,
                    companyIds: new Set<string>(),
                    companyNames: new Set<string>(),
                    count: 0,
                    oldestDate: p.startDate,
                    newestDate: p.startDate
                });
            }
            const stat = groupingMap.get(key)!;
            stat.count++;
            stat.companyIds.add(p.companyId);
            stat.companyNames.add(p.company.name);
            if (p.startDate < stat.oldestDate) stat.oldestDate = p.startDate;
            if (p.startDate > stat.newestDate) stat.newestDate = p.startDate;
        }

        // Fetch dealer names once
        const dealerIds = Array.from(new Set(unprocessedPolicies.map(p => p.dealerId!)));
        const dealers = await prisma.dealer.findMany({
            where: { id: { in: dealerIds }, deletedAt: null },
            select: { id: true, name: true, phone: true }
        });

        const dealerDict = Object.fromEntries(dealers.map(d => [d.id, d]));

        return Array.from(groupingMap.values()).map(g => ({
            dealerId: g.dealerId,
            dealerName: dealerDict[g.dealerId]?.name || 'Unknown',
            dealerPhone: dealerDict[g.dealerId]?.phone || 'N/A',
            companyIds: Array.from(g.companyIds),
            companyNames: Array.from(g.companyNames),
            unprocessedCount: g.count,
            oldestPolicyDate: g.oldestDate,
            newestPolicyDate: g.newestDate
        })).sort((a, b) => new Date(a.oldestPolicyDate).getTime() - new Date(b.oldestPolicyDate).getTime());
    }

    /**
     * Get aggregated business volume (OD/TP totals) for a dealer/period.
     * Used by the calculator to show context before percentages are entered.
     */
    async getStats(userId: string, role: string, query: { dealerId: string; periodStart: string; periodEnd: string; companyId?: string; companyIds?: string | string[] }) {
        const { dealerId, periodStart, periodEnd, companyId, companyIds } = query;
        const parsedStartDate = getStartOfDayIST(periodStart);
        const parsedEndDate = getEndOfDayIST(periodEnd);

        const policies = await prisma.policy.findMany({
            where: {
                ...ownerFilter(userId, role),
                dealerId,
                ...(companyId && { companyId }),
                ...(companyIds && {
                    companyId: { in: Array.isArray(companyIds) ? companyIds : companyIds.split(',') }
                }),
                deletedAt: null,
                status: { in: ['active', 'expired'] }, // EXCLUDE CANCELLED
                startDate: {
                    gte: parsedStartDate,
                    lte: parsedEndDate,
                },
                commissionPolicies: { none: {} }
            },
            select: {
                od: true,
                tp: true,
                premiumAmount: true,
                make: true,
            }
        });

        const totalOd = policies.reduce((sum, p) => sum + (p.od || 0), 0);
        const totalTp = policies.reduce((sum, p) => sum + (p.tp || 0), 0);
        const totalPremium = policies.reduce((sum, p) => sum + (p.premiumAmount || 0), 0);

        const makesMap = new Map<string, number>();
        for (const p of policies) {
            const m = p.make || 'Other';
            makesMap.set(m, (makesMap.get(m) || 0) + 1);
        }
        const topMakes = Array.from(makesMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([make, count]) => ({ make, count }));

        return {
            policyCount: policies.length,
            totalOdPremium: totalOd,
            totalTpPremium: totalTp,
            totalPremium: totalPremium,
            topMakes
        };
    }

    /**
     * Preview: Fetch dealer's policies in date range and calculate commission WITHOUT saving.
     */
    async preview(userId: string, role: string, data: CommissionPreviewInput) {
        const { dealerId, periodStart, periodEnd, odPercentage, tpPercentage, companyId } = data;

        const parsedStartDate = getStartOfDayIST(periodStart);
        const parsedEndDate = getEndOfDayIST(periodEnd);

        // Validate dealer ownership
        const dealer = await prisma.dealer.findFirst({
            where: { id: dealerId, ...ownerFilter(userId, role), deletedAt: null },
        });
        if (!dealer) throw Object.assign(new Error('Dealer not found or unauthorized'), { statusCode: 404 });

        // Count how many policies in this date range are ALREADY processed (for this dealer+company)
        const alreadyProcessedCount = await prisma.policy.count({
            where: {
                ...ownerFilter(userId, role),
                dealerId,
                ...(companyId && { companyId }),
                deletedAt: null,
                status: { in: ['active', 'expired'] }, // Consistency
                startDate: {
                    gte: parsedStartDate,
                    lte: parsedEndDate,
                },
                commissionPolicies: {
                    some: {} // Has at least one commission record mapped
                }
            }
        });

        // Fetch motor policies for this dealer within the date range
        const policies = await prisma.policy.findMany({
            where: {
                ...ownerFilter(userId, role),
                dealerId,
                ...(companyId && { companyId }),
                deletedAt: null,
                status: { in: ['active', 'expired'] }, // EXCLUDE CANCELLED
                startDate: {
                    gte: parsedStartDate,
                    lte: parsedEndDate,
                },
                // Critical logic: Exclude policies that are already tied to an existing commission record!
                commissionPolicies: {
                    none: {}
                }
            },
            include: { customer: true },
            orderBy: { startDate: 'desc' },
        });

        // Calculate commission per policy
        const policyBreakdown = policies.map(p => {
            const od = p.od || 0;
            const tp = p.tp || 0;
            const odCommission = parseFloat(((od * odPercentage) / 100).toFixed(2));
            const tpCommission = parseFloat(((tp * tpPercentage) / 100).toFixed(2));
            return {
                policyId: p.id,
                policyNumber: p.policyNumber,
                customerName: p.customer?.name || 'Unknown',
                vehicleNumber: p.vehicleNumber,
                make: p.make,
                model: p.model,
                vehicleClass: p.vehicleClass,
                od,
                tp,
                premiumAmount: p.premiumAmount,
                startDate: p.startDate,
                expiryDate: p.expiryDate,
                odCommission,
                tpCommission,
                totalCommission: parseFloat((odCommission + tpCommission).toFixed(2)),
            };
        });

        const totalOdCommission = parseFloat(policyBreakdown.reduce((sum, p) => sum + p.odCommission, 0).toFixed(2));
        const totalTpCommission = parseFloat(policyBreakdown.reduce((sum, p) => sum + p.tpCommission, 0).toFixed(2));
        const totalCommission = parseFloat((totalOdCommission + totalTpCommission).toFixed(2));
        const totalPremium = parseFloat(policyBreakdown.reduce((sum, p) => sum + p.premiumAmount, 0).toFixed(2));

        return {
            dealer: { id: dealer.id, name: dealer.name },
            periodStart,
            periodEnd,
            odPercentage,
            tpPercentage,
            companyId,
            alreadyProcessedCount,
            policies: policyBreakdown,
            summary: { totalOdCommission, totalTpCommission, totalCommission, totalPremium, policyCount: policyBreakdown.length },
        };
    }

    /**
     * Create: Calculate AND save commission to history.
     */
    async create(userId: string, role: string, data: CommissionCreateInput) {
        // First run preview to get the full calculation for the range
        let preview = await this.preview(userId, role, data);

        // If specific policyIds are provided (Selective Commissioning), filter the preview set
        if (data.policyIds && data.policyIds.length > 0) {
            const filteredPolicies = preview.policies.filter(p => data.policyIds!.includes(p.policyId));
            if (filteredPolicies.length === 0) {
                throw Object.assign(new Error('None of the selected policies are valid for this dealer/period'), { statusCode: 400 });
            }

            const totalOd = parseFloat(filteredPolicies.reduce((sum, p) => sum + p.odCommission, 0).toFixed(2));
            const totalTp = parseFloat(filteredPolicies.reduce((sum, p) => sum + p.tpCommission, 0).toFixed(2));
            const totalComm = parseFloat((totalOd + totalTp).toFixed(2));
            const totalPrem = parseFloat(filteredPolicies.reduce((sum, p) => sum + p.premiumAmount, 0).toFixed(2));

            preview = {
                ...preview,
                policies: filteredPolicies,
                summary: {
                    totalOdCommission: totalOd,
                    totalTpCommission: totalTp,
                    totalCommission: totalComm,
                    totalPremium: totalPrem,
                    policyCount: filteredPolicies.length
                }
            };
        }

        if (preview.policies.length === 0) {
            throw Object.assign(new Error('No policies found for the selected dealer and date range'), { statusCode: 400 });
        }

        // Save in a transaction
        return prisma.$transaction(async (tx) => {
            const commission = await tx.commission.create({
                data: {
                    userId,
                    dealerId: data.dealerId,
                    companyId: data.companyId,
                    periodStart: new Date(data.periodStart),
                    periodEnd: new Date(data.periodEnd),
                    odPercentage: data.odPercentage,
                    tpPercentage: data.tpPercentage,
                    totalOdCommission: preview.summary.totalOdCommission,
                    totalTpCommission: preview.summary.totalTpCommission,
                    totalCommission: preview.summary.totalCommission,
                    totalPremium: preview.summary.totalPremium,
                    notes: data.notes,
                    status: 'draft',
                },
            });

            // Save snapshot of each policy's data at this point in time
            for (const p of preview.policies) {
                await tx.commissionPolicy.create({
                    data: {
                        commissionId: commission.id,
                        policyId: p.policyId,
                        vehicleNumber: p.vehicleNumber,
                        make: p.make,
                        model: p.model,
                        vehicleClass: p.vehicleClass,
                        od: p.od,
                        tp: p.tp,
                        premiumAmount: p.premiumAmount,
                        startDate: p.startDate,
                        expiryDate: p.expiryDate,
                        odCommission: p.odCommission,
                        tpCommission: p.tpCommission,
                    },
                });
            }

            const resObj = { ...commission, policyCount: preview.policies.length };

            ActivityService.logActivity({
                userId,
                userRole: role,
                action: 'CREATE',
                entityType: 'commission',
                entityId: commission.id,
                title: `Commission Calculated: ₹${commission.totalCommission}`,
                description: `Commission generated for dealer (${preview.policies.length} policies linked)`,
                metadata: { commissionId: commission.id, totalCommission: commission.totalCommission, dealerId: data.dealerId },
            });

            return resObj;
        });
    }

    /**
     * List all commissions for the user, with filters.
     */
    async findAll(userId: string, dealerId?: string, status?: string, dateFrom?: string, dateTo?: string, companyId?: string, companyIds?: string | string[]) {
        const where: any = { userId };
        if (dealerId) where.dealerId = dealerId;
        if (status) where.status = status;
        if (companyId) where.companyId = companyId;
        if (companyIds) {
            where.companyId = { in: typeof companyIds === 'string' ? companyIds.split(',') : companyIds };
        }

        if (dateFrom || dateTo) {
            where.periodStart = {};
            if (dateFrom) where.periodStart.gte = getStartOfDayIST(dateFrom);
            if (dateTo) where.periodStart.lte = getEndOfDayIST(dateTo);
        }

        return prisma.commission.findMany({
            where,
            include: {
                dealer: { select: { id: true, name: true } },
                company: { select: { id: true, name: true } },
                _count: { select: { commissionPolicies: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a single commission with full policy breakdown.
     */
    async findById(userId: string, id: string) {
        const commission = await prisma.commission.findFirst({
            where: { id, userId },
            include: {
                dealer: { select: { id: true, name: true, phone: true } },
                company: { select: { id: true, name: true } },
                commissionPolicies: {
                    orderBy: { startDate: 'desc' },
                    include: { policy: { include: { customer: true } } }
                },
            },
        });

        if (!commission) throw Object.assign(new Error('Commission record not found'), { statusCode: 404 });
        return commission;
    }

    /**
     * Update status or notes of a commission record.
     */
    async update(userId: string, id: string, data: CommissionUpdateInput) {
        const commission = await prisma.commission.findFirst({ where: { id, userId } });
        if (!commission) throw Object.assign(new Error('Commission record not found'), { statusCode: 404 });

        return prisma.commission.update({
            where: { id },
            data: {
                ...(data.status !== undefined && { status: data.status }),
                ...(data.notes !== undefined && { notes: data.notes }),
            },
            include: {
                dealer: { select: { id: true, name: true } },
            },
        });
    }

    /**
     * Delete a commission record (and its policy snapshots via cascade).
     */
    async bulkUpdateStatus(userId: string, data: CommissionBulkUpdateInput) {
        return prisma.commission.updateMany({
            where: {
                id: { in: data.ids },
                userId
            },
            data: { status: data.status }
        });
    }

    async delete(userId: string, id: string) {
        const commission = await prisma.commission.findFirst({ where: { id, userId } });
        if (!commission) throw Object.assign(new Error('Commission record not found'), { statusCode: 404 });

        if (commission.status === 'paid') {
            throw Object.assign(new Error('Cannot delete a commission that has already been marked as PAID'), { statusCode: 400 });
        }

        return prisma.commission.delete({ where: { id } });
    }
}

export const commissionService = new CommissionService();
