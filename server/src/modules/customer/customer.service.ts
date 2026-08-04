import prisma from '../../utils/prisma';
import { Prisma } from '@prisma/client';
import { mapPolicyStatus } from '../../utils/date';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

interface CreateCustomerInput {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    dob?: string | Date | null;
}

export class CustomerService {
    async create(userId: string, role: string, data: CreateCustomerInput) {
        // Clean up empty strings from frontend
        if (data.dob === '') data.dob = null;
        if (data.phone === '') data.phone = undefined;
        if (data.email === '') data.email = undefined;

        // Transform dob to Date
        if (data.dob && typeof data.dob === 'string') {
            data.dob = new Date(data.dob);
        }

        // Check duplicate name and phone number combination (Block)
        if (data.phone && data.name) {
            const existing = await prisma.customer.findMany({
                where: {
                    ...ownerFilter(userId, role),
                    phone: data.phone,
                    name: { equals: data.name, mode: 'insensitive' },
                    deletedAt: null
                },
                select: { name: true }
            });
            if (existing.length > 0) {
                throw Object.assign(new Error(`Duplicate customer: "${data.name}" with phone ${data.phone} already exists`), { statusCode: 400 });
            }
        }

        const customer = await prisma.customer.create({
            data: { userId, ...data, createdBy: role, updatedBy: role },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'CREATE',
            entityType: 'customer',
            entityId: customer.id,
            title: `New Customer Added: ${customer.name}`,
            description: `Customer account created for ${customer.name} (${customer.phone || 'No phone'})`,
            metadata: { customerId: customer.id, name: customer.name, phone: customer.phone, email: customer.email },
        });

        return { customer };
    }

    async findAll(userId: string, role: string, page = 1, limit = 10, search?: string) {
        const where: any = {
            ...ownerFilter(userId, role),
            deletedAt: null,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { policies: true, claims: true, payments: true } },
                },
            }),
            prisma.customer.count({ where }),
        ]);

        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async findById(userId: string, role: string, id: string) {
        const customer = await prisma.customer.findFirst({
            where: { id, ...ownerFilter(userId, role), deletedAt: null },
            include: {
                policies: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
                payments: { orderBy: { dueDate: 'desc' }, take: 10 },
                claims: { orderBy: { createdAt: 'desc' }, take: 10 },
                followUps: { orderBy: { nextFollowUpDate: 'desc' }, take: 10 },
            },
        });

        if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
        return {
            ...customer,
            policies: customer.policies.map(mapPolicyStatus)
        };
    }

    async update(userId: string, role: string, id: string, data: Partial<CreateCustomerInput>) {
        const existingCustomer = await this.findById(userId, role, id);

        // Clean up empty strings from frontend
        if (data.dob === '') data.dob = null;
        if (data.phone === '') data.phone = undefined;
        if (data.email === '') data.email = undefined;

        const nameToVerify = data.name !== undefined ? data.name : existingCustomer.name;
        const phoneToVerify = data.phone !== undefined ? data.phone : existingCustomer.phone;

        // Check duplicate name and phone number combination (excluding current customer) (Block)
        if (phoneToVerify && nameToVerify) {
            const existing = await prisma.customer.findMany({
                where: {
                    ...ownerFilter(userId, role),
                    phone: phoneToVerify,
                    name: { equals: nameToVerify, mode: 'insensitive' },
                    deletedAt: null,
                    NOT: { id },
                },
                select: { name: true }
            });
            if (existing.length > 0) {
                throw Object.assign(new Error(`Duplicate customer: "${nameToVerify}" with phone ${phoneToVerify} already exists`), { statusCode: 400 });
            }
        }

        const customer = await prisma.customer.update({ where: { id }, data: { ...data, updatedBy: role } });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'UPDATE',
            entityType: 'customer',
            entityId: customer.id,
            title: `Customer Updated: ${customer.name}`,
            description: `Updated customer information for ${customer.name}`,
            metadata: { customerId: customer.id, name: customer.name },
        });

        return customer;
    }

    async checkDuplicate(userId: string, role: string, query: { name?: string; phone?: string; excludeId?: string }) {
        const { name, phone, excludeId } = query;
        if (!name || !phone) {
            return { exists: false };
        }

        const existing = await prisma.customer.findFirst({
            where: {
                ...ownerFilter(userId, role),
                phone,
                name: { equals: name.trim(), mode: 'insensitive' },
                deletedAt: null,
                ...(excludeId && { NOT: { id: excludeId } })
            },
            select: { id: true, name: true }
        });

        return { exists: !!existing, customer: existing };
    }

    async softDelete(userId: string, role: string, id: string) {
        await this.findById(userId, role, id); // ownership check

        return prisma.$transaction(async (tx) => {
            const now = new Date();
            const ow = ownerFilter(userId, role);

            // 1. Get all policy IDs for this customer
            const policies = await tx.policy.findMany({
                where: { customerId: id, ...ow, deletedAt: null },
                select: { id: true }
            });
            const policyIds = policies.map(p => p.id);

            // 2. Delete all children of those policies
            if (policyIds.length > 0) {
                await tx.payment.deleteMany({ where: { policyId: { in: policyIds }, ...ow } });
                await tx.claim.deleteMany({ where: { policyId: { in: policyIds }, ...ow } });
                await tx.followUp.deleteMany({ where: { policyId: { in: policyIds }, ...ow } });

                // 3. Soft delete the policies themselves
                await tx.policy.updateMany({
                    where: { id: { in: policyIds }, ...ow },
                    data: { deletedAt: now }
                });
            }

            // 4. Soft delete the customer
            const deletedCustomer = await tx.customer.update({
                where: { id },
                data: { deletedAt: now }
            });

            ActivityService.logActivity({
                userId,
                userRole: role,
                action: 'DELETE',
                entityType: 'customer',
                entityId: id,
                title: `Customer Deleted: ${deletedCustomer.name}`,
                description: `Soft deleted customer ${deletedCustomer.name} and linked records`,
                metadata: { customerId: id, name: deletedCustomer.name },
            });

            return deletedCustomer;
        });
    }
}

export const customerService = new CustomerService();
