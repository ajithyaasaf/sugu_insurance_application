import prisma from '../../utils/prisma';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

interface AttachOfferInput {
    policyId: string;
    offerAmount: number;
    notes?: string;
}

interface UpdateOfferInput {
    offerAmount?: number;
    notes?: string;
}

export class OfferService {
    /**
     * Synchronize a policy's payment record when an offer is created, modified, or removed.
     * Handles 'pending', 'partial', and 'overdue' payments gracefully.
     * Recalculates status ('paid' vs 'partial' vs 'pending') based on the new target amount and collections.
     */
    private async syncPaymentWithOffer(tx: any, policyId: string, targetAmount: number) {
        const payment = await tx.payment.findFirst({
            where: { policyId },
            orderBy: { createdAt: 'asc' },
        });

        if (!payment) return null;

        const allPayments = await tx.payment.findMany({
            where: { policyId },
        });
        const paidAmount = allPayments.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
        let newStatus = payment.status;

        // Money is the source of truth:
        if (paidAmount >= targetAmount - 0.01 && targetAmount > 0) {
            newStatus = 'paid';
        } else if (paidAmount > 0.01) {
            newStatus = 'partial';
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
            newStatus = (dueDate && dueDate < today) ? 'overdue' : 'pending';
        }

        const updated = await tx.payment.update({
            where: { id: payment.id },
            data: {
                amount: targetAmount,
                status: newStatus as any,
                paidDate: newStatus === 'paid' && !payment.paidDate ? new Date() : (newStatus !== 'paid' && paidAmount === 0 ? null : payment.paidDate),
            },
        });

        return updated;
    }

    /**
     * One-time auto-healing check to repair any existing production records
     * where an offer was attached after partial payment and the payment remained unsynced.
     */
    private async autoHealUnsyncedOffers() {
        try {
            const unsyncedOffers = await prisma.policyOffer.findMany({
                where: {
                    policy: {
                        deletedAt: null,
                    },
                },
                include: {
                    policy: {
                        include: {
                            payments: {
                                orderBy: { createdAt: 'asc' },
                            },
                        },
                    },
                },
            });

            for (const offer of unsyncedOffers) {
                const payment = offer.policy.payments[0];
                if (payment && Math.abs(payment.amount - offer.customerPayable) > 0.01) {
                    await prisma.$transaction(async (tx) => {
                        await this.syncPaymentWithOffer(tx, offer.policyId, offer.customerPayable);
                    });
                }
            }
        } catch {
            // Non-blocking background healing
        }
    }

    /**
     * Attach a company promotional offer to a policy (post-issuance).
     * - Validates the policy belongs to the user (ownership check).
     * - Validates offerAmount < grossPremium and <= remaining unpaid balance.
     * - Creates PolicyOffer record and synchronizes Payment record to customerPayable.
     * - Automatically marks payment as 'paid' if collections cover customerPayable.
     */
    async attachOffer(userId: string, role: string, data: AttachOfferInput) {
        // 1. Fetch policy with ownership check
        const policy = await prisma.policy.findFirst({
            where: { id: data.policyId, deletedAt: null, ...ownerFilter(userId, role) },
            include: { customer: true, company: true, offer: true },
        });
        if (!policy) {
            throw Object.assign(new Error('Policy not found or unauthorized'), { statusCode: 404 });
        }

        // 2. Prevent duplicate offers
        if (policy.offer) {
            throw Object.assign(
                new Error('An offer has already been attached to this policy. Remove it first to reattach.'),
                { statusCode: 409 }
            );
        }

        const grossPremium = policy.totalPremium ?? policy.premiumAmount;

        // Fetch existing payments to determine already collected amount
        const existingPayments = await prisma.payment.findMany({
            where: { policyId: data.policyId },
        });
        const totalPaidSoFar = existingPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
        const remainingUnpaid = Math.max(0, grossPremium - totalPaidSoFar);

        // 3. Validate offer amount does not exceed gross premium or remaining balance
        if (data.offerAmount >= grossPremium) {
            throw Object.assign(
                new Error(`Offer amount (${data.offerAmount}) cannot be equal to or exceed gross premium (${grossPremium})`),
                { statusCode: 400 }
            );
        }

        if (totalPaidSoFar > 0 && data.offerAmount > remainingUnpaid + 0.01) {
            throw Object.assign(
                new Error(`Offer amount (₹${data.offerAmount}) cannot exceed remaining unpaid balance (₹${remainingUnpaid})`),
                { statusCode: 400 }
            );
        }

        const customerPayable = grossPremium - data.offerAmount;

        // 4. Transactionally create the offer and adjust the payment record
        const result = await prisma.$transaction(async (tx) => {
            const offer = await tx.policyOffer.create({
                data: {
                    userId,
                    policyId: data.policyId,
                    companyId: policy.companyId,
                    grossPremium,
                    offerAmount: data.offerAmount,
                    customerPayable,
                    notes: data.notes,
                    createdBy: role,
                },
                include: { policy: { include: { customer: true, company: true } } },
            });

            // Adjust payment record (pending, partial, or overdue) to reflect customerPayable
            await this.syncPaymentWithOffer(tx, data.policyId, customerPayable);

            return offer;
        });

        // 5. Log activity (non-blocking)
        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'CREATE',
            entityType: 'offer',
            entityId: result.id,
            title: `Offer Attached: ${result.policy.customer?.name}`,
            description: `Offer of ₹${data.offerAmount} applied on policy ${result.policy.policyNumber || result.policyId}. Net customer payable: ₹${customerPayable}`,
            metadata: {
                policyId: data.policyId,
                grossPremium,
                offerAmount: data.offerAmount,
                customerPayable,
            },
        });

        return result;
    }

    /**
     * Update the offer amount or notes for an existing offer.
     */
    async updateOffer(userId: string, role: string, offerId: string, data: UpdateOfferInput) {
        const existing = await prisma.policyOffer.findFirst({
            where: { id: offerId, ...ownerFilter(userId, role) },
            include: { policy: true },
        });
        if (!existing) {
            throw Object.assign(new Error('Offer not found or unauthorized'), { statusCode: 404 });
        }

        const newOfferAmount = data.offerAmount ?? existing.offerAmount;
        const grossPremium = existing.grossPremium;

        const existingPayments = await prisma.payment.findMany({
            where: { policyId: existing.policyId },
        });
        const totalPaidSoFar = existingPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
        const remainingUnpaid = Math.max(0, grossPremium - totalPaidSoFar);

        if (newOfferAmount >= grossPremium) {
            throw Object.assign(
                new Error(`Offer amount (${newOfferAmount}) cannot be equal to or exceed gross premium (${grossPremium})`),
                { statusCode: 400 }
            );
        }

        if (totalPaidSoFar > 0 && newOfferAmount > remainingUnpaid + 0.01) {
            throw Object.assign(
                new Error(`Offer amount (₹${newOfferAmount}) cannot exceed remaining unpaid balance (₹${remainingUnpaid})`),
                { statusCode: 400 }
            );
        }

        const newCustomerPayable = grossPremium - newOfferAmount;

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.policyOffer.update({
                where: { id: offerId },
                data: {
                    offerAmount: newOfferAmount,
                    customerPayable: newCustomerPayable,
                    notes: data.notes !== undefined ? data.notes : existing.notes,
                },
                include: { policy: { include: { customer: true, company: true } } },
            });

            // Sync payment record to new net amount and recalculate status
            await this.syncPaymentWithOffer(tx, existing.policyId, newCustomerPayable);

            return updated;
        });

        return result;
    }

    /**
     * Remove an offer from a policy.
     * Restores the payment amount to the full gross premium and recalculates status.
     */
    async removeOffer(userId: string, role: string, offerId: string) {
        const existing = await prisma.policyOffer.findFirst({
            where: { id: offerId, ...ownerFilter(userId, role) },
        });
        if (!existing) {
            throw Object.assign(new Error('Offer not found or unauthorized'), { statusCode: 404 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.policyOffer.delete({ where: { id: offerId } });

            // Restore payment to full gross premium and re-evaluate status
            await this.syncPaymentWithOffer(tx, existing.policyId, existing.grossPremium);
        });

        return { message: 'Offer removed successfully' };
    }

    /**
     * Paginated list of all offers, with optional filters.
     */
    async findAll(
        userId: string,
        role: string,
        page = 1,
        limit = 10,
        search?: string,
        companyId?: string,
        dateFrom?: string,
        dateTo?: string,
    ) {
        // Auto-heal any legacy unsynced payment records in the background
        await this.autoHealUnsyncedOffers();

        const where: any = {
            ...ownerFilter(userId, role),
            policy: { deletedAt: null },
            ...(companyId && { companyId }),
            ...(dateFrom || dateTo
                ? {
                    createdAt: {
                        ...(dateFrom && { gte: new Date(dateFrom) }),
                        ...(dateTo && { lte: new Date(dateTo + 'T23:59:59.999Z') }),
                    },
                }
                : {}),
            ...(search && {
                OR: [
                    { policy: { policyNumber: { contains: search, mode: 'insensitive' } } },
                    { policy: { vehicleNumber: { contains: search, mode: 'insensitive' } } },
                    { policy: { customer: { name: { contains: search, mode: 'insensitive' } } } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            prisma.policyOffer.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    policy: {
                        include: {
                            customer: true,
                            dealer: true,
                            payments: { orderBy: { createdAt: 'desc' } },
                        },
                    },
                    company: true,
                    user: { select: { id: true, name: true, role: true } },
                },
            }),
            prisma.policyOffer.count({ where }),
        ]);

        return {
            data,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Summary metrics for the Offers page header cards.
     */
    async getSummary(userId: string, role: string) {
        // Auto-heal any legacy unsynced payment records in the background
        await this.autoHealUnsyncedOffers();

        const where = {
            ...ownerFilter(userId, role),
            policy: { deletedAt: null },
        };

        const [totals, count] = await Promise.all([
            prisma.policyOffer.aggregate({
                where,
                _sum: { offerAmount: true, grossPremium: true, customerPayable: true },
                _count: true,
            }),
            prisma.policyOffer.count({ where }),
        ]);

        return {
            totalOffers: count,
            totalOfferAmount: totals._sum.offerAmount ?? 0,
            totalGrossPremium: totals._sum.grossPremium ?? 0,
            totalCustomerPayable: totals._sum.customerPayable ?? 0,
        };
    }

    /**
     * Find a single offer by ID (for detail view or debugging).
     */
    async findById(userId: string, role: string, offerId: string) {
        const offer = await prisma.policyOffer.findFirst({
            where: { id: offerId, ...ownerFilter(userId, role) },
            include: {
                policy: { include: { customer: true } },
                company: true,
            },
        });
        if (!offer) {
            throw Object.assign(new Error('Offer not found'), { statusCode: 404 });
        }
        return offer;
    }
}

export const offerService = new OfferService();
