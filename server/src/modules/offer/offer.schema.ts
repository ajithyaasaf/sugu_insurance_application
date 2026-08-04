import { z } from 'zod';

export const attachOfferSchema = z.object({
    body: z.object({
        policyId: z.string().uuid('Valid policy ID is required'),
        offerAmount: z
            .number({ required_error: 'Offer amount is required' })
            .positive('Offer amount must be greater than 0'),
        notes: z.string().optional(),
    }),
});

export const updateOfferSchema = z.object({
    body: z.object({
        offerAmount: z.number().positive('Offer amount must be greater than 0').optional(),
        notes: z.string().optional(),
    }),
});

export type AttachOfferInput = z.infer<typeof attachOfferSchema>['body'];
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>['body'];
