import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { getStartOfTodayIST, mapPaymentStatus, getStartOfDayIST, getEndOfDayIST } from '../../utils/date';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

interface CreatePaymentInput {
    policyId: string;
    customerId: string;
    amount: number;
    dueDate: string;
    paidDate?: string;
    paidAmount?: number;
    status?: string;
    notes?: string;
}

export class PaymentService {
    async create(userId: string, role: string, data: CreatePaymentInput) {
        return prisma.$transaction(async (tx) => {
            // 1. Fetch the policy to validate premium bounds
            const policy = await tx.policy.findFirst({
                where: { id: data.policyId, ...ownerFilter(userId, role) },
            });
            if (!policy) throw Object.assign(new Error('Policy not found'), { statusCode: 404 });

            // 2. Validate total payment schedule does not exceed policy premium
            const existingPayments = await tx.payment.aggregate({
                where: { policyId: data.policyId },
                _sum: { amount: true },
            });
            const totalExistingAmount = existingPayments._sum.amount || 0;
            const fullPremium = policy.totalPremium || policy.premiumAmount;
            if (totalExistingAmount + data.amount > fullPremium + 0.01) {
                throw Object.assign(
                    new Error(`Total payment schedule cannot exceed the premium (${fullPremium})`),
                    { statusCode: 400 }
                );
            }

            // 3. Derive status from paidAmount — money is the source of truth
            const paidAmount = data.paidAmount || 0;
            let initialStatus: string;
            if (paidAmount >= data.amount - 0.01 && data.amount > 0) {
                initialStatus = 'paid';
            } else if (paidAmount > 0.01) {
                initialStatus = 'partial';
            } else {
                initialStatus = data.status || 'pending';
            }

            // 4. Create the payment
            const payment = await tx.payment.create({
                data: {
                    userId,
                    policyId: data.policyId,
                    customerId: data.customerId,
                    amount: data.amount,
                    dueDate: new Date(data.dueDate),
                    paidDate: data.paidDate ? new Date(data.paidDate) : null,
                    paidAmount: data.paidAmount,
                    status: initialStatus as any,
                    notes: data.notes,
                    createdBy: role,
                },
                include: { customer: true, policy: true },
            });

            return mapPaymentStatus(payment);
        });
    }


    async findAll(
        userId: string,
        role: string,
        page = 1,
        limit = 10,
        status?: string,
        search?: string,
        dateFrom?: string,
        dateTo?: string,
        dealerId?: string,
        policyNumber?: string,
        vehicleNumber?: string,
        vehicleClass?: string,
    ) {
        const todayIST = getStartOfTodayIST();

        // Build the dueDate filter carefully to avoid key collision
        // when both 'overdue' status filter and date range filter are active.
        let dueDateFilter: any = {};
        if (status === 'overdue') {
            dueDateFilter = { lt: todayIST };
        }
        if (dateFrom || dateTo) {
            dueDateFilter = {
                ...dueDateFilter,
                ...(dateFrom && { gte: getStartOfDayIST(dateFrom) }),
                ...(dateTo && { lte: getEndOfDayIST(dateTo) }),
            };
        }

        const where: any = {
            ...ownerFilter(userId, role),
            // Status filter logic:
            // 'overdue' as virtual filter → match pending/partial with past dueDate
            // 'pending' → also include DB records stored as 'overdue' (legacy from detectOverdue mutations)
            // other statuses → match directly
            ...(status === 'overdue' && { status: { in: ['pending', 'partial', 'overdue'] } }),
            ...(status === 'pending' && { status: { in: ['pending', 'overdue', 'partial'] } }),
            ...(status && status !== 'overdue' && status !== 'pending' && { status: status as any }),
            ...(Object.keys(dueDateFilter).length > 0 && { dueDate: dueDateFilter }),
            ...(dealerId === 'direct' ? { policy: { dealerId: null } } : dealerId ? { policy: { dealerId } } : {}),
            ...(policyNumber && { policy: { policyNumber: { contains: policyNumber, mode: 'insensitive' } } }),
            ...(vehicleNumber && { policy: { vehicleNumber: { contains: vehicleNumber, mode: 'insensitive' } } }),
            ...(vehicleClass && { policy: { vehicleClass: vehicleClass as any } }),
            ...(search && {
                OR: [
                    { customer: { name: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                    { policy: { policyNumber: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                    { policy: { vehicleNumber: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                ],
            }),
        };

        const [data, total, summary] = await Promise.all([
            prisma.payment.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dueDate: 'desc' },
                include: { customer: true, policy: { include: { offer: true } } },
            }),
            prisma.payment.count({ where }),
            prisma.payment.aggregate({
                where,
                _sum: { amount: true, paidAmount: true },
            }),
        ]);

        const totalAmount = summary._sum.amount || 0;
        const totalPaidAmount = summary._sum.paidAmount || 0;
        const totalOutstanding = Math.max(0, totalAmount - totalPaidAmount);

        return {
            data: data.map(mapPaymentStatus),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                totalOutstanding,
            },
        };
    }

    async findById(userId: string, role: string, id: string) {
        const payment = await prisma.payment.findFirst({
            where: { id, ...ownerFilter(userId, role) },
            include: { customer: true, policy: { include: { offer: true } } },
        });
        if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
        return mapPaymentStatus(payment);
    }

    // Update payment — supports partial payments via $transaction
    async update(userId: string, role: string, id: string, data: Partial<CreatePaymentInput>) {
        return prisma.$transaction(async (tx: any) => {
            // 1. Ownership check
            const payment = await tx.payment.findFirst({
                where: { id, ...ownerFilter(userId, role) },
                include: { policy: true }
            });
            if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });

            // 2. Atomic validation for amount changes
            const currentAmount = data.amount !== undefined ? data.amount : payment.amount;
            const fullPremium = payment.policy.totalPremium || payment.policy.premiumAmount; // Corrected Fallback

            if (data.amount !== undefined && data.amount !== payment.amount) {
                const existingPayments = await tx.payment.aggregate({
                    where: { policyId: payment.policyId, id: { not: id } },
                    _sum: { amount: true }
                });
                const totalExistingAmount = existingPayments._sum.amount || 0;
                if (totalExistingAmount + data.amount > fullPremium + 0.01) {
                    throw Object.assign(new Error(`Total payment schedule cannot exceed the premium (${fullPremium})`), { statusCode: 400 });
                }
            }

            const currentPaidAmount = data.paidAmount !== undefined ? data.paidAmount : (payment.paidAmount || 0);

            if (data.paidAmount !== undefined && data.paidAmount > currentAmount + 0.01) {
                throw Object.assign(new Error('Paid amount cannot exceed the installment amount'), { statusCode: 400 });
            }

            let newStatus = data.status as any;
            let finalMessage = 'Payment updated successfully';

            // Status Logic: Money is the Source of Truth. Stored statuses: paid, partial, pending
            if (currentPaidAmount >= currentAmount - 0.01 && currentAmount > 0) {
                // Scenario 1: Fully Paid
                if (newStatus && newStatus !== 'paid') {
                    finalMessage = `Payment updated. Note: Status forced to 'paid' because full payment was received.`;
                }
                newStatus = 'paid';
            } else if (currentPaidAmount > 0.01) {
                // Scenario 2: Partial Payment
                if (newStatus && newStatus !== 'partial') {
                    finalMessage = `Payment updated. Note: Status forced to 'partial' because it is partially paid.`;
                }
                newStatus = 'partial';
            } else {
                // Scenario 3: No Payment
                if (newStatus && newStatus !== 'pending') {
                    finalMessage = `Payment updated. Note: Status set to 'pending' as no payment was recorded.`;
                }
                newStatus = 'pending';

                if ((payment.status === 'paid' || payment.status === 'partial') && currentPaidAmount < 0.01) {
                    finalMessage = `Payment reverted to 'pending' because paid amount was cleared.`;
                }
            }

            const updatedPayment = await tx.payment.update({
                where: { id },
                data: {
                    ...data,
                    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
                    paidDate: data.paidDate ? new Date(data.paidDate) : (currentPaidAmount > 0 ? undefined : (data.paidDate === '' ? null : undefined)),
                    status: newStatus,
                },
                include: { customer: true, policy: true },
            });

            // 3. Data Consistency: Sync Policy Status
            if (updatedPayment.status !== 'paid') {
                const totalPaidAmount = await tx.payment.aggregate({
                    where: {
                        policyId: updatedPayment.policyId,
                        status: 'paid'
                    },
                    _sum: { paidAmount: true }
                });

                const totalPaid = totalPaidAmount._sum.paidAmount || 0;

                if (totalPaid < 0.01 && updatedPayment.policy.status === 'active') {
                    // Optional: You could update policy status here if business rules require it
                }
            }

            const resultObj = { payment: mapPaymentStatus(updatedPayment), message: finalMessage };

            ActivityService.logActivity({
                userId,
                userRole: role,
                action: updatedPayment.status === 'paid' ? 'PAYMENT_REC' : 'UPDATE',
                entityType: 'payment',
                entityId: updatedPayment.id,
                title: `Payment ${updatedPayment.status.toUpperCase()}: ₹${updatedPayment.paidAmount || updatedPayment.amount}`,
                description: `Payment updated for ${updatedPayment.customer?.name || 'Customer'} (Status: ${updatedPayment.status})`,
                metadata: {
                    paymentId: updatedPayment.id,
                    amount: updatedPayment.amount,
                    paidAmount: updatedPayment.paidAmount,
                    status: updatedPayment.status,
                    policyId: updatedPayment.policyId,
                },
            });

            return resultObj;
        });
    }

    async delete(userId: string, role: string, id: string) {
        await this.findById(userId, role, id);
        return prisma.payment.delete({ where: { id } });
    }

    async detectOverdue(userId: string, role: string) {
        const todayIST = getStartOfTodayIST();
        const count = await prisma.payment.count({
            where: {
                ...ownerFilter(userId, role),
                status: { in: ['pending', 'partial'] },
                dueDate: { lt: todayIST },
            },
        });
        return { updated: count };
    }
}

export const paymentService = new PaymentService();
