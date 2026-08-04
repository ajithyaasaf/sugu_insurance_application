import prisma from '../../utils/prisma';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

interface CreateDealerInput {
    name: string;
    phone?: string;
    address?: string;
}

export class DealerService {
    async create(userId: string, role: string, data: CreateDealerInput) {
        const dealer = await prisma.dealer.create({
            data: {
                ...data,
                userId,
                createdBy: role,
                updatedBy: role,
            },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'CREATE',
            entityType: 'dealer',
            entityId: dealer.id,
            title: `New Dealer Added: ${dealer.name}`,
            description: `Dealer account registered (${dealer.phone || 'No phone'})`,
            metadata: { dealerId: dealer.id, name: dealer.name },
        });

        return dealer;
    }

    async findAll(userId: string, role: string, page = 1, limit = 10, search?: string) {
        const where: any = {
            ...ownerFilter(userId, role),
            deletedAt: null,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            prisma.dealer.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { policies: true }
                    }
                }
            }),
            prisma.dealer.count({ where }),
        ]);

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async findById(userId: string, role: string, id: string) {
        const dealer = await prisma.dealer.findFirst({
            where: { id, deletedAt: null, ...ownerFilter(userId, role) },
            include: { policies: true },
        });

        if (!dealer) throw Object.assign(new Error('Dealer not found'), { statusCode: 404 });
        return dealer;
    }

    async update(userId: string, role: string, id: string, data: Partial<CreateDealerInput>) {
        await this.findById(userId, role, id); // Ensure it exists and belongs to user

        return prisma.dealer.update({
            where: { id },
            data: {
                ...data,
                updatedBy: role,
            },
        });
    }

    async delete(userId: string, role: string, id: string) {
        const dealer = await this.findById(userId, role, id);

        // Check for linked policies
        const linkedPoliciesCount = await prisma.policy.count({
            where: { dealerId: id, deletedAt: null },
        });

        if (linkedPoliciesCount > 0) {
            throw Object.assign(new Error('Cannot delete dealer with linked policies'), { statusCode: 400 });
        }

        // Hard delete as requested
        return prisma.dealer.delete({
            where: { id },
        });
    }
}

export const dealerService = new DealerService();
