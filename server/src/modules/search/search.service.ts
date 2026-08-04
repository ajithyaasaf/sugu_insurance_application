import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { mapPolicyStatus } from '../../utils/date';
import { ownerFilter } from '../../utils/rbac';

export class SearchService {
    async globalSearch(userId: string, role: string, query: string) {
        const ow = ownerFilter(userId, role);
        if (!query || query.length < 2) {
            return { customers: [], leads: [], policies: [] };
        }

        const normalizedQuery = query.toUpperCase().replace(/\s+/g, '_');
        const VALID_VEHICLE_CLASSES = [
            'TW', 'PCV', 'PVT', 'GCV', 'Misc_D', 'CPM', 'Fire', 
            'Public_Liability', 'SAOD_TW', 'SAOD_PVT', 'CPA', 
            'Home_Insurance', 'RAK_Policy', 'Others'
        ];
        const matchedClasses = [query.toUpperCase(), normalizedQuery].filter(
            val => val && VALID_VEHICLE_CLASSES.includes(val)
        );

        const [customers, leads, policies] = await Promise.all([
            prisma.customer.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                        { phone: { contains: query, mode: 'insensitive' } },
                    ],
                },
                take: 5,
            }),
            prisma.lead.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    OR: [
                        { name: { contains: query, mode: 'insensitive' } },
                        { phone: { contains: query, mode: 'insensitive' } },
                        { interestedProduct: { contains: query, mode: 'insensitive' } },
                        { vehicleNumber: { contains: query, mode: 'insensitive' } },
                        { make: { contains: query, mode: 'insensitive' } },
                        { model: { contains: query, mode: 'insensitive' } },
                        ...(matchedClasses.length > 0 ? [{ vehicleClass: { in: matchedClasses as any } }] : [])
                    ],
                },
                take: 5,
            }),
            prisma.policy.findMany({
                where: {
                    ...ow,
                    deletedAt: null,
                    OR: [
                        { policyNumber: { contains: query, mode: 'insensitive' } },
                        { vehicleNumber: { contains: query, mode: 'insensitive' } },
                        { productName: { contains: query, mode: 'insensitive' } },
                        { make: { contains: query, mode: 'insensitive' } },
                        { model: { contains: query, mode: 'insensitive' } },
                        ...(matchedClasses.length > 0 ? [{ vehicleClass: { in: matchedClasses as any } }] : [])
                    ],
                },
                include: { customer: true, company: true },
                take: 5,
            }),
        ]);

        return {
            customers,
            leads,
            policies: policies.map(mapPolicyStatus)
        };
    }
}

export const searchService = new SearchService();
