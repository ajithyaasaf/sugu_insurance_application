import prisma from '../../utils/prisma';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

interface CreateClaimInput {
    policyId: string;
    customerId: string;
    claimNumber?: string;
    claimAmount?: number | null;
    estimatedAmount?: number | null;
    billAmount?: number | null;
    claimDate: string;
    status?: string;
    reason?: string;
    surveyorName?: string;
    surveyorPhone?: string;
    workshopName?: string;
}

export class ClaimService {
    async create(userId: string, role: string, data: CreateClaimInput) {
        // Ownership validation for related entities
        const [policy, customer] = await Promise.all([
            prisma.policy.findFirst({ where: { id: data.policyId, ...ownerFilter(userId, role), deletedAt: null } }),
            prisma.customer.findFirst({ where: { id: data.customerId, ...ownerFilter(userId, role), deletedAt: null } }),
        ]);

        if (!policy) throw Object.assign(new Error('Policy not found or unauthorized'), { statusCode: 404 });
        if (!customer) throw Object.assign(new Error('Customer not found or unauthorized'), { statusCode: 404 });

        // Cross-entity integrity: The selected policy must actually belong to the selected customer
        if (policy.customerId !== data.customerId) {
            throw Object.assign(
                new Error('The selected policy does not belong to the selected customer'),
                { statusCode: 400 }
            );
        }

        const claim = await prisma.claim.create({
            data: {
                userId,
                policyId: data.policyId,
                customerId: data.customerId,
                claimNumber: data.claimNumber,
                claimAmount: data.claimAmount ?? null,
                estimatedAmount: data.estimatedAmount ?? null,
                billAmount: data.billAmount ?? null,
                claimDate: new Date(data.claimDate),
                status: data.status || 'filed',
                reason: data.reason,
                surveyorName: data.surveyorName,
                surveyorPhone: data.surveyorPhone,
                workshopName: data.workshopName,
                createdBy: role,
            },
            include: { customer: true, policy: true },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'CLAIM_FILED',
            entityType: 'claim',
            entityId: claim.id,
            title: `Claim Filed: ${claim.claimNumber || 'New Claim'}`,
            description: `Claim filed for ${claim.customer?.name || 'Customer'} (Status: ${claim.status})`,
            metadata: {
                claimId: claim.id,
                claimNumber: claim.claimNumber,
                claimAmount: claim.claimAmount,
                status: claim.status,
            },
        });

        return claim;
    }

    async findAll(userId: string, role: string, page = 1, limit = 10, search?: string, status?: string, vehicleClass?: string) {
        const normalizedSearch = search?.toUpperCase().replace(/\s+/g, '_');
        const VALID_VEHICLE_CLASSES = [
            'TW', 'PCV', 'PVT', 'GCV', 'Misc_D', 'CPM', 'Fire', 
            'Public_Liability', 'SAOD_TW', 'SAOD_PVT', 'CPA', 
            'Home_Insurance', 'Others'
        ];
        const matchedClasses = [search?.toUpperCase(), normalizedSearch].filter(
            val => val && VALID_VEHICLE_CLASSES.includes(val)
        );

        const where: any = {
            ...ownerFilter(userId, role),
            ...(search && {
                OR: [
                    { customer: { name: { contains: search, mode: 'insensitive' } } },
                    { claimNumber: { contains: search, mode: 'insensitive' } },
                    { policy: { policyNumber: { contains: search, mode: 'insensitive' } } },
                    { policy: { vehicleNumber: { contains: search, mode: 'insensitive' } } },
                    ...(matchedClasses.length > 0 ? [{ policy: { vehicleClass: { in: matchedClasses as any } } }] : [])
                ],
            }),
            ...(status && { status: status as any }),
            ...(vehicleClass && { policy: { vehicleClass: vehicleClass as any } }),
        };

        const [data, total] = await Promise.all([
            prisma.claim.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { customer: true, policy: true },
            }),
            prisma.claim.count({ where }),
        ]);

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async findById(userId: string, role: string, id: string) {
        const claim = await prisma.claim.findFirst({
            where: { id, ...ownerFilter(userId, role) },
            include: { customer: true, policy: true },
        });
        if (!claim) throw Object.assign(new Error('Claim not found'), { statusCode: 404 });
        return claim;
    }

    async update(userId: string, role: string, id: string, data: Partial<CreateClaimInput>) {
        await this.findById(userId, role, id); // ownership check
        const claim = await prisma.claim.update({
            where: { id },
            data: {
                ...(data.claimNumber !== undefined && { claimNumber: data.claimNumber }),
                ...(data.claimAmount !== undefined && { claimAmount: data.claimAmount as any }),
                ...(data.estimatedAmount !== undefined && { estimatedAmount: data.estimatedAmount as any }),
                ...(data.billAmount !== undefined && { billAmount: data.billAmount as any }),
                ...(data.claimDate !== undefined && { claimDate: new Date(data.claimDate) }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.reason !== undefined && { reason: data.reason }),
                ...(data.surveyorName !== undefined && { surveyorName: data.surveyorName }),
                ...(data.surveyorPhone !== undefined && { surveyorPhone: data.surveyorPhone }),
                ...(data.workshopName !== undefined && { workshopName: data.workshopName }),
            },
            include: { customer: true, policy: true },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'UPDATE',
            entityType: 'claim',
            entityId: claim.id,
            title: `Claim Updated: ${claim.claimNumber || 'Claim'}`,
            description: `Claim updated for ${claim.customer?.name || 'Customer'} (Status: ${claim.status})`,
            metadata: { claimId: claim.id, claimNumber: claim.claimNumber, status: claim.status },
        });

        return claim;
    }

    async delete(userId: string, role: string, id: string) {
        await this.findById(userId, role, id); // ownership check
        
        const claim = await prisma.claim.delete({ where: { id } });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'DELETE',
            entityType: 'claim',
            entityId: id,
            title: `Claim Deleted: ${claim.claimNumber || 'Claim'}`,
            description: `Deleted claim record ${claim.claimNumber || 'Claim'}`,
            metadata: { claimId: id, claimNumber: claim.claimNumber },
        });

        return claim;
    }
}

export const claimService = new ClaimService();
