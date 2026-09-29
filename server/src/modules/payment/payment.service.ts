import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { getStartOfTodayIST, mapPaymentStatus, getStartOfDayIST, getEndOfDayIST } from '../../utils/date';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';
import { BatchCollectInput } from './payment.schema';

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

        const policyWhere: any = {};
        if (role === 'staff') {
            policyWhere.dealerId = dealerId && dealerId !== 'direct' ? dealerId : { not: null };
        } else if (dealerId === 'direct') {
            policyWhere.dealerId = null;
        } else if (dealerId) {
            policyWhere.dealerId = dealerId;
        }

        if (policyNumber) {
            policyWhere.policyNumber = { contains: policyNumber, mode: 'insensitive' };
        }
        if (vehicleNumber) {
            policyWhere.vehicleNumber = { contains: vehicleNumber, mode: 'insensitive' };
        }
        if (vehicleClass) {
            policyWhere.vehicleClass = vehicleClass as any;
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
            ...(Object.keys(policyWhere).length > 0 && { policy: policyWhere }),
            ...(search && {
                OR: [
                    { customer: { name: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                    { policy: { policyNumber: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                    { policy: { vehicleNumber: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                    { policy: { referenceName: { contains: search, mode: 'insensitive' }, deletedAt: null } },
                    { paymentBatch: { receiptNo: { contains: search, mode: 'insensitive' } } },
                    { paymentBatch: { payerName: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        };

        const [data, total, summary] = await Promise.all([
            prisma.payment.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dueDate: 'desc' },
                include: { customer: true, policy: { include: { offer: true } }, paymentBatch: true },
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
            include: { customer: true, policy: { include: { offer: true } }, paymentBatch: true },
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

    async getUnsettledPayers(userId: string, role: string) {
        const ow = ownerFilter(userId, role);

        // Fetch ALL active dealers, distinct references, and current unsettled payments in parallel
        const [allDealers, allPoliciesWithRef, unsettledPayments] = await Promise.all([
            prisma.dealer.findMany({
                where: { ...ow, deletedAt: null },
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
            prisma.policy.findMany({
                where: { ...ow, deletedAt: null, referenceName: { not: null } },
                select: { referenceName: true },
                distinct: ['referenceName'],
            }),
            prisma.payment.findMany({
                where: {
                    ...ow,
                    status: { in: ['pending', 'partial'] },
                    policy: { deletedAt: null },
                },
                include: {
                    policy: {
                        select: {
                            id: true,
                            dealerId: true,
                            referenceName: true,
                        },
                    },
                },
            }),
        ]);

        const dealerStats = new Map<string, { unsettledCount: number; totalUnpaid: number }>();
        const refStats = new Map<string, { unsettledCount: number; totalUnpaid: number }>();

        for (const p of unsettledPayments) {
            const unpaid = Math.max(0, p.amount - (p.paidAmount || 0));
            if (unpaid <= 0) continue;

            if (p.policy.dealerId) {
                const stat = dealerStats.get(p.policy.dealerId) || { unsettledCount: 0, totalUnpaid: 0 };
                stat.unsettledCount += 1;
                stat.totalUnpaid += unpaid;
                dealerStats.set(p.policy.dealerId, stat);
            }

            if (p.policy.referenceName && p.policy.referenceName.trim()) {
                const refKey = p.policy.referenceName.trim().toUpperCase();
                const stat = refStats.get(refKey) || { unsettledCount: 0, totalUnpaid: 0 };
                stat.unsettledCount += 1;
                stat.totalUnpaid += unpaid;
                refStats.set(refKey, stat);
            }
        }

        const dealers = allDealers.map(d => {
            const stat = dealerStats.get(d.id) || { unsettledCount: 0, totalUnpaid: 0 };
            return {
                id: d.id,
                name: d.name,
                unsettledCount: stat.unsettledCount,
                totalUnpaid: stat.totalUnpaid,
            };
        }).sort((a, b) => {
            if (b.totalUnpaid !== a.totalUnpaid) return b.totalUnpaid - a.totalUnpaid;
            return a.name.localeCompare(b.name);
        });

        const refNameSet = new Set<string>();
        for (const p of allPoliciesWithRef) {
            if (p.referenceName && p.referenceName.trim()) {
                refNameSet.add(p.referenceName.trim());
            }
        }

        const references = Array.from(refNameSet).map(name => {
            const stat = refStats.get(name.toUpperCase()) || { unsettledCount: 0, totalUnpaid: 0 };
            return {
                name,
                unsettledCount: stat.unsettledCount,
                totalUnpaid: stat.totalUnpaid,
            };
        }).sort((a, b) => {
            if (b.totalUnpaid !== a.totalUnpaid) return b.totalUnpaid - a.totalUnpaid;
            return a.name.localeCompare(b.name);
        });

        return { dealers, references };
    }

    async getUnsettledByPayer(userId: string, role: string, payerType: 'dealer' | 'reference', payerValue: string) {
        const ow = ownerFilter(userId, role);

        const policyFilter: any = {
            deletedAt: null,
            ...(payerType === 'dealer' ? { dealerId: payerValue } : { referenceName: { equals: payerValue, mode: 'insensitive' } }),
        };

        const policies = await prisma.policy.findMany({
            where: {
                ...ow,
                ...policyFilter,
                payments: {
                    some: {
                        status: { in: ['pending', 'partial'] },
                    },
                },
            },
            select: {
                id: true,
                policyNumber: true,
                vehicleNumber: true,
                vehicleClass: true,
                policyType: true,
                productName: true,
                startDate: true,
                expiryDate: true,
                totalPremium: true,
                premiumAmount: true,
                customer: { select: { id: true, name: true, phone: true } },
                company: { select: { id: true, name: true } },
                payments: {
                    where: {
                        status: { in: ['pending', 'partial'] },
                    },
                    select: {
                        id: true,
                        dueDate: true,
                        amount: true,
                        paidAmount: true,
                        status: true,
                    },
                    orderBy: { dueDate: 'asc' },
                },
            },
            orderBy: { startDate: 'asc' }, // FIFO: Oldest policy first!
        });

        // Map into items ready for distribution
        const items = policies.flatMap(pol => {
            const fullPremium = pol.totalPremium || pol.premiumAmount;
            return pol.payments.map(pmt => {
                const unpaid = Math.max(0, pmt.amount - (pmt.paidAmount || 0));
                return {
                    policyId: pol.id,
                    paymentId: pmt.id,
                    policyNumber: pol.policyNumber || 'Draft',
                    vehicleNumber: pol.vehicleNumber || '—',
                    vehicleClass: pol.vehicleClass,
                    policyType: pol.policyType,
                    productName: pol.productName,
                    customerName: pol.customer.name,
                    customerPhone: pol.customer.phone,
                    companyName: pol.company?.name || '—',
                    startDate: pol.startDate,
                    expiryDate: pol.expiryDate,
                    dueDate: pmt.dueDate,
                    fullPremium,
                    paymentAmount: pmt.amount,
                    alreadyPaid: pmt.paidAmount || 0,
                    remainingBalance: unpaid,
                    status: pmt.status,
                };
            });
        }).filter(item => item.remainingBalance > 0);

        const totalUnpaid = items.reduce((sum, item) => sum + item.remainingBalance, 0);

        return {
            items,
            summary: {
                totalPolicies: policies.length,
                totalPayments: items.length,
                totalUnpaid,
            },
        };
    }

    async createBatchCollection(userId: string, role: string, data: BatchCollectInput) {
        // Validate total allocated equals total amount within 0.01 tolerance
        const totalAllocated = data.allocations.reduce((sum, a) => sum + a.amount, 0);
        if (Math.abs(totalAllocated - data.totalAmount) > 0.01) {
            throw Object.assign(
                new Error(`Allocated total (₹${totalAllocated.toFixed(2)}) must match received amount (₹${data.totalAmount.toFixed(2)})`),
                { statusCode: 400 }
            );
        }

        return prisma.$transaction(async (tx) => {
            // Generate human-friendly sequential receipt number: BATCH-YYYYMMDD-XXXX
            const now = new Date();
            const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
            const count = await tx.paymentBatch.count({
                where: { receiptNo: { startsWith: `BATCH-${datePrefix}` } },
            });
            const receiptNo = `BATCH-${datePrefix}-${String(count + 1).padStart(4, '0')}`;

            // Create PaymentBatch
            const batch = await tx.paymentBatch.create({
                data: {
                    userId,
                    receiptNo,
                    payerType: data.payerType,
                    payerId: data.payerId || null,
                    payerName: data.payerName,
                    totalAmount: data.totalAmount,
                    paymentDate: new Date(data.paymentDate),
                    paymentMethod: data.paymentMethod || null,
                    referenceNumber: data.referenceNumber || null,
                    notes: data.notes || null,
                    createdBy: role,
                },
            });

            // Update each allocated payment
            const updatedPayments: any[] = [];
            for (const alloc of data.allocations) {
                if (alloc.amount <= 0) continue;

                const payment = await tx.payment.findFirst({
                    where: { id: alloc.paymentId, ...ownerFilter(userId, role) },
                    include: { customer: true, policy: true },
                });

                if (!payment) {
                    throw Object.assign(new Error(`Payment ${alloc.paymentId} not found or unauthorized`), { statusCode: 404 });
                }

                const currentPaid = payment.paidAmount || 0;
                const newPaid = currentPaid + alloc.amount;

                if (newPaid > payment.amount + 0.01) {
                    throw Object.assign(
                        new Error(`Allocated amount for policy ${payment.policy?.policyNumber || payment.policyId} exceeds remaining balance`),
                        { statusCode: 400 }
                    );
                }

                const newStatus = (newPaid >= payment.amount - 0.01) ? 'paid' : 'partial';
                const noteAppend = `Batch #${receiptNo} (+₹${alloc.amount})`;
                const updatedNotes = payment.notes ? `${payment.notes} | ${noteAppend}` : noteAppend;

                const updated = await tx.payment.update({
                    where: { id: payment.id },
                    data: {
                        paidAmount: newPaid,
                        status: newStatus as any,
                        paidDate: new Date(data.paymentDate),
                        paymentBatchId: batch.id,
                        notes: updatedNotes,
                    },
                    include: { customer: true, policy: true },
                });

                updatedPayments.push(updated);
            }

            // Log Activity
            ActivityService.logActivity({
                userId,
                userRole: role,
                action: 'PAYMENT_REC',
                entityType: 'payment',
                entityId: batch.id,
                title: `Batch Payment: ₹${data.totalAmount} from ${data.payerName}`,
                description: `Batch collection of ₹${data.totalAmount} received from ${data.payerName} (${data.payerType}). Allocated across ${updatedPayments.length} policies. Receipt #${receiptNo}`,
                metadata: {
                    batchId: batch.id,
                    receiptNo,
                    payerType: data.payerType,
                    payerName: data.payerName,
                    totalAmount: data.totalAmount,
                    policiesCount: updatedPayments.length,
                },
            });

            return {
                batch,
                updatedCount: updatedPayments.length,
                payments: updatedPayments.map(mapPaymentStatus),
            };
        });
    }

    async getBatches(userId: string, role: string, page = 1, limit = 10, search?: string) {
        const where: any = {
            ...ownerFilter(userId, role),
            ...(search && {
                OR: [
                    { receiptNo: { contains: search, mode: 'insensitive' } },
                    { payerName: { contains: search, mode: 'insensitive' } },
                    { referenceNumber: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            prisma.paymentBatch.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { paymentDate: 'desc' },
                include: {
                    payments: {
                        include: { customer: true, policy: true },
                    },
                },
            }),
            prisma.paymentBatch.count({ where }),
        ]);

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getBatchById(userId: string, role: string, id: string) {
        const batch = await prisma.paymentBatch.findFirst({
            where: { id, ...ownerFilter(userId, role) },
            include: {
                payments: {
                    include: { customer: true, policy: true },
                },
            },
        });
        if (!batch) throw Object.assign(new Error('Batch receipt not found'), { statusCode: 404 });
        return batch;
    }
}

export const paymentService = new PaymentService();
