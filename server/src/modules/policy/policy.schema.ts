import { z } from 'zod';

export const createPolicySchema = z.object({
    body: z.object({
        customerId: z.string().min(1, 'Customer ID is required'),
        companyId: z.string().min(1, 'Company ID is required'),
        policyNumber: z.string().optional().or(z.literal('')),
        policyType: z.enum(['motor', 'health', 'life', 'non_motor', 'other']),
        vehicleNumber: z.string().optional().or(z.literal('')),
        startDate: z.string().min(1, 'Start date is required'),
        expiryDate: z.string().min(1, 'Expiry date is required'),
        sumInsured: z.number().min(0).optional(),
        premiumAmount: z.number().min(0, 'Premium amount must be valid'),
        premiumMode: z.enum(['monthly', 'quarterly', 'halfYearly', 'yearly', 'single']).optional(),
        productName: z.string().optional().or(z.literal('')),
        noOfYears: z.number().min(1).optional(),
        // Note: status is NOT accepted during creation — it always defaults to 'active'
        parentPolicyId: z.string().optional(),
        make: z.string().optional().or(z.literal('')),
        model: z.string().optional().or(z.literal('')),
        registrationDate: z.string().optional().nullable(),
        vehicleClass: z.enum(['TW', 'PCV', 'PVT', 'GCV', 'Misc_D', 'CPM', 'Fire', 'Public_Liability', 'SAOD_TW', 'SAOD_PVT', 'CPA', 'Home_Insurance', 'RAK_Policy', 'Others']).optional(),
        idv: z.number().min(0).optional(),
        od: z.number().min(0).optional(),
        tp: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        totalPremium: z.number().min(0).optional(),
        paymentMethod: z.enum(['Cash', 'UPI', 'Cheque', 'Online', 'NEFT', 'APD']).optional(),
        paidAmount: z.number().min(0).optional(),
        dealerId: z.string().optional().or(z.literal('')),
        policyOrigin: z.enum(['new_vehicle', 'fresh', 'external_renewal', 'in_system_renewal']).optional().default('fresh'),
        ncbPercentage: z.number().min(0).max(50).optional().nullable(),
        tpStartDate: z.string().optional().nullable(),
        tpEndDate: z.string().optional().nullable(),
    }),
});

export const updatePolicySchema = z.object({
    body: z.object({
        customerId: z.string().optional(),
        companyId: z.string().optional(),
        policyNumber: z.string().optional().or(z.literal('')),
        policyType: z.enum(['motor', 'health', 'life', 'non_motor', 'other']).optional(),
        vehicleNumber: z.string().optional().or(z.literal('')),
        startDate: z.string().optional(),
        expiryDate: z.string().optional(),
        sumInsured: z.number().min(0).optional(),
        premiumAmount: z.number().min(0).optional(),
        premiumMode: z.enum(['monthly', 'quarterly', 'halfYearly', 'yearly', 'single']).optional(),
        productName: z.string().optional().or(z.literal('')),
        noOfYears: z.number().min(1).optional(),
        // Only 'active' (reinstatement) or 'cancelled' can be set manually
        status: z.enum(['active', 'cancelled']).optional(),
        parentPolicyId: z.string().optional(),
        make: z.string().optional().or(z.literal('')),
        model: z.string().optional().or(z.literal('')),
        registrationDate: z.string().optional().nullable(),
        vehicleClass: z.enum(['TW', 'PCV', 'PVT', 'GCV', 'Misc_D', 'CPM', 'Fire', 'Public_Liability', 'SAOD_TW', 'SAOD_PVT', 'CPA', 'Home_Insurance', 'RAK_Policy', 'Others']).optional(),
        idv: z.number().min(0).optional(),
        od: z.number().min(0).optional(),
        tp: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        totalPremium: z.number().min(0).optional(),
        paymentMethod: z.enum(['Cash', 'UPI', 'Cheque', 'Online', 'NEFT', 'APD']).optional(),
        dealerId: z.string().optional().or(z.literal('')),
        policyOrigin: z.enum(['new_vehicle', 'fresh', 'external_renewal', 'in_system_renewal']).optional(),
        ncbPercentage: z.number().min(0).max(50).optional().nullable(),
        tpStartDate: z.string().optional().nullable(),
        tpEndDate: z.string().optional().nullable(),
    }),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>['body'];
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>['body'];
