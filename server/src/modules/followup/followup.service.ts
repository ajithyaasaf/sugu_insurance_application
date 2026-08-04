import prisma from '../../utils/prisma';
import { ownerFilter } from '../../utils/rbac';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';

interface CreateFollowUpInput {
    customerId: string;
    policyId?: string;
    nextFollowUpDate: string;
    notes?: string;
    status?: string;
}

export class FollowUpService {
    async create(userId: string, role: string, data: CreateFollowUpInput) {
        const followup = await prisma.followUp.create({
            data: {
                userId,
                customerId: data.customerId,
                policyId: data.policyId || null,
                nextFollowUpDate: new Date(data.nextFollowUpDate),
                notes: data.notes,
                status: (data.status as any) || 'pending',
                createdBy: role,
            },
            include: { customer: true, policy: true },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'CREATE',
            entityType: 'followup',
            entityId: followup.id,
            title: `Follow-up Scheduled: ${followup.customer?.name || 'Client'}`,
            description: `Follow-up set for ${new Date(data.nextFollowUpDate).toLocaleDateString()} - Notes: ${data.notes || 'None'}`,
            metadata: { followupId: followup.id, customerId: data.customerId, nextFollowUpDate: data.nextFollowUpDate },
        });

        return followup;
    }

    async findAll(userId: string, role: string, page = 1, limit = 10, status?: string, date?: string, search?: string, vehicleClass?: string) {
        const where: any = {
            ...ownerFilter(userId, role),
            ...(status && { status: status as any }),
            ...(date && {
                nextFollowUpDate: {
                    gte: new Date(date),
                    lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
                },
            }),
            ...(search && {
                customer: { name: { contains: search, mode: 'insensitive' } },
            }),
            ...(vehicleClass && { policy: { vehicleClass: vehicleClass as any } }),
        };

        const [data, total] = await Promise.all([
            prisma.followUp.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nextFollowUpDate: 'asc' },
                include: { customer: true, policy: true },
            }),
            prisma.followUp.count({ where }),
        ]);

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async findById(userId: string, role: string, id: string) {
        const followUp = await prisma.followUp.findFirst({
            where: { id, ...ownerFilter(userId, role) },
            include: { customer: true, policy: true },
        });
        if (!followUp) throw Object.assign(new Error('Follow-up not found'), { statusCode: 404 });
        return followUp;
    }

    async update(userId: string, role: string, id: string, data: Partial<CreateFollowUpInput>) {
        await this.findById(userId, role, id);
        const followup = await prisma.followUp.update({
            where: { id },
            data: {
                ...data,
                nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
                status: data.status as any,
            },
            include: { customer: true, policy: true },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: followup.status === 'completed' ? 'STATUS_CHANGE' : 'UPDATE',
            entityType: 'followup',
            entityId: followup.id,
            title: followup.status === 'completed' ? `Follow-up Completed: ${followup.customer?.name || 'Client'}` : `Follow-up Updated: ${followup.customer?.name || 'Client'}`,
            description: `Follow-up status: ${followup.status} - Notes: ${followup.notes || 'None'}`,
            metadata: { followupId: followup.id, status: followup.status },
        });

        return followup;
    }

    async delete(userId: string, role: string, id: string) {
        await this.findById(userId, role, id);
        
        const followup = await prisma.followUp.delete({ where: { id }, include: { customer: true } });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'DELETE',
            entityType: 'followup',
            entityId: id,
            title: `Follow-up Cancelled: ${followup.customer?.name || 'Client'}`,
            description: `Deleted follow-up scheduled for ${followup.nextFollowUpDate.toLocaleDateString()}`,
            metadata: { followupId: id },
        });

        return followup;
    }
}

export const followUpService = new FollowUpService();
