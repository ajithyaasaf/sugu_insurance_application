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
     * Attach a company promotional offer to a policy (post-issuance).
     * - Validates the policy belongs to the user (ownership check).
     * - Validates offerAmount < grossPremium.
     * - Creates PolicyOffer record and adjusts the first pending Payment record to customerPayable.
     * - Payment model logic (paid/partial/overdue) is never modified.
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

        // 3. Validate offer amount does not exceed gross premium
        if (data.offerAmount >= grossPremium) {
            throw Object.assign(
                new Error(`Offer amount (${data.offerAmount}) cannot be equal to or exceed gross premium (${grossPremium})`),
                { statusCode: 400 }
            );
        }

        const customerPayable = grossPremium - data.offerAmount;

        // 4. Transactionally create the offer and adjust the pending payment record
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

            // Adjust ONLY the first pending payment record for this policy
            // to reflect the new net customer payable amount.
            // Paid/partial payments remain untouched.
            const pendingPayment = await tx.payment.findFirst({
                where: { policyId: data.policyId, status: 'pending' },
                orderBy: { createdAt: 'asc' },
            });

            if (pendingPayment) {
                await tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: { amount: customerPayable },
                });
            }

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

        if (newOfferAmount >= grossPremium) {
            throw Object.assign(
                new Error(`Offer amount (${newOfferAmount}) cannot be equal to or exceed gross premium (${grossPremium})`),
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

            // Sync the pending payment record to the new net amount
            const pendingPayment = await tx.payment.findFirst({
                where: { policyId: existing.policyId, status: 'pending' },
                orderBy: { createdAt: 'asc' },
            });

            if (pendingPayment) {
                await tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: { amount: newCustomerPayable },
                });
            }

            return updated;
        });

        return result;
    }

    /**
     * Remove an offer from a policy.
     * Restores the pending payment amount to the full gross premium.
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

            // Restore pending payment to full gross premium
            const pendingPayment = await tx.payment.findFirst({
                where: { policyId: existing.policyId, status: 'pending' },
                orderBy: { createdAt: 'asc' },
            });

            if (pendingPayment) {
                await tx.payment.update({
                    where: { id: pendingPayment.id },
                    data: { amount: existing.grossPremium },
                });
            }
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
