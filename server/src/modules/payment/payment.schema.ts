import { z } from 'zod';

export const createPaymentSchema = z.object({
    body: z.object({
        policyId: z.string().min(1, 'Policy ID is required'),
        customerId: z.string().min(1, 'Customer ID is required'),
        amount: z.number().min(0, 'Amount must be valid'),
        dueDate: z.string().min(1, 'Due date is required'),
        paidDate: z.string().optional().or(z.literal('')),
        paidAmount: z.number().min(0).optional(),
        status: z.enum(['pending', 'partial', 'paid', 'overdue']).optional(),
        notes: z.string().optional().or(z.literal('')),
    }),
});

export const updatePaymentSchema = z.object({
    body: z.object({
        policyId: z.string().optional(),
        customerId: z.string().optional(),
        amount: z.number().min(0).optional(),
        dueDate: z.string().optional(),
        paidDate: z.string().optional().or(z.literal('')),
        paidAmount: z.number().min(0).optional(),
        status: z.enum(['pending', 'partial', 'paid', 'overdue']).optional(),
        notes: z.string().optional().or(z.literal('')),
    }),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>['body'];
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>['body'];

export const batchCollectSchema = z.object({
    body: z.object({
        payerType: z.enum(['dealer', 'reference']),
        payerId: z.string().optional().nullable(),
        payerName: z.string().min(1, 'Payer name is required'),
        totalAmount: z.number().positive('Total amount must be greater than zero'),
        paymentDate: z.string().min(1, 'Payment date is required'),
        paymentMethod: z.string().optional().or(z.literal('')),
        referenceNumber: z.string().optional().or(z.literal('')),
        notes: z.string().optional().or(z.literal('')),
        allocations: z.array(z.object({
            policyId: z.string().min(1, 'Policy ID is required'),
            paymentId: z.string().min(1, 'Payment ID is required'),
            amount: z.number().min(0, 'Allocation amount cannot be negative'),
        })).min(1, 'At least one policy allocation is required'),
    }),
});

export type BatchCollectInput = z.infer<typeof batchCollectSchema>['body'];
