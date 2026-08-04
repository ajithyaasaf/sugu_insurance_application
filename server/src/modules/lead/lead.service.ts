import prisma from '../../utils/prisma';
import { Prisma, PolicyType, PolicyVehicleClass } from '@prisma/client';
import { ownerFilter } from '../../utils/rbac';
import { ActivityService } from '../activity/activity.service';

interface CreateLeadInput {
    name: string;
    phone?: string;
    interestedProduct?: string;
    status?: 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
    nextFollowUpDate?: string;
    notes?: string;
    // Quote Fields
    policyType?: PolicyType;
    companyId?: string;
    vehicleNumber?: string;
    make?: string;
    model?: string;
    registrationDate?: string;
    vehicleClass?: PolicyVehicleClass;
    idv?: number;
    od?: number;
    tp?: number;
    tax?: number;
    totalPremium?: number;
    premiumAmount?: number;
    startDate?: string;
    expiryDate?: string;
    dealerId?: string;
    policyOrigin?: 'new_vehicle' | 'fresh' | 'external_renewal' | 'in_system_renewal';
    ncbPercentage?: number | null;
    tpStartDate?: string | null;
    tpEndDate?: string | null;
}

interface UpdateLeadInput {
    name?: string;
    phone?: string;
    interestedProduct?: string;
    status?: 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
    nextFollowUpDate?: string | null;
    notes?: string | null;
    // Quote Fields
    policyType?: PolicyType;
    companyId?: string;
    vehicleNumber?: string;
    make?: string;
    model?: string;
    registrationDate?: string | null;
    vehicleClass?: PolicyVehicleClass;
    idv?: number;
    od?: number;
    tp?: number;
    tax?: number;
    totalPremium?: number;
    premiumAmount?: number;
    startDate?: string;
    expiryDate?: string;
    dealerId?: string;
    policyOrigin?: 'new_vehicle' | 'fresh' | 'external_renewal' | 'in_system_renewal';
    ncbPercentage?: number | null;
    tpStartDate?: string | null;
    tpEndDate?: string | null;
}

export class LeadService {
    async create(userId: string, role: string, data: CreateLeadInput) {
        const lead = await prisma.lead.create({
            data: {
                userId,
                name: data.name,
                phone: data.phone,
                interestedProduct: data.interestedProduct,
                status: data.status || 'new',
                nextFollowUpDate: data.nextFollowUpDate
                    ? new Date(data.nextFollowUpDate)
                    : null,
                notes: data.notes,

                // Quote Fields
                policyType: data.policyType,
                companyId: data.companyId || null,
                vehicleNumber: data.vehicleNumber || null,
                make: data.make || null,
                model: data.model || null,
                registrationDate: data.registrationDate ? new Date(data.registrationDate) : null,
                vehicleClass: data.vehicleClass || null,
                idv: data.idv,
                od: data.od,
                tp: data.tp,
                tax: data.tax,
                totalPremium: data.totalPremium,
                premiumAmount: data.premiumAmount,
                startDate: data.startDate ? new Date(data.startDate) : null,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                tpStartDate: data.tpStartDate ? new Date(data.tpStartDate) : null,
                tpEndDate: data.tpEndDate ? new Date(data.tpEndDate) : null,
                dealerId: data.dealerId || null,
                policyOrigin: data.policyOrigin as any || null,
                ncbPercentage: data.ncbPercentage ?? null,

                createdBy: role,
                updatedBy: role,
            },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'CREATE',
            entityType: 'lead',
            entityId: lead.id,
            title: `New Lead Created: ${lead.name}`,
            description: `Lead created for ${lead.name} (${lead.phone || 'No phone'})`,
            metadata: { leadId: lead.id, status: lead.status, interestedProduct: lead.interestedProduct },
        });

        return lead;
    }

    async findAll(
        userId: string,
        role: string,
        page: number = 1,
        limit: number = 10,
        search?: string,
        status?: string,
        excludeConverted?: boolean,
        vehicleClass?: string
    ) {
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
            deletedAt: null,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                    { vehicleNumber: { contains: search, mode: 'insensitive' } },
                    ...(matchedClasses.length > 0 ? [{ vehicleClass: { in: matchedClasses as any } }] : [])
                ],
            }),
            ...(status ? { status: status as any } : (excludeConverted ? { status: { not: 'converted' } } : {})),
            ...(vehicleClass && { vehicleClass: vehicleClass as any }),
        };

        const [data, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.lead.count({ where }),
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

    async findById(userId: string, role: string, id: string) {
        const lead = await prisma.lead.findFirst({
            where: { id, ...ownerFilter(userId, role), deletedAt: null },
        });

        if (!lead) {
            throw Object.assign(new Error('Lead not found'), { statusCode: 404 });
        }

        return lead;
    }

    async update(userId: string, role: string, id: string, data: UpdateLeadInput) {
        await this.findById(userId, role, id);

        const lead = await prisma.lead.update({
            where: { id },
            data: {
                ...data,
                nextFollowUpDate: data.nextFollowUpDate
                    ? new Date(data.nextFollowUpDate)
                    : data.nextFollowUpDate === null
                        ? null
                        : undefined,

                // Process dates if provided
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
                tpStartDate: data.tpStartDate === null ? null : (data.tpStartDate ? new Date(data.tpStartDate) : undefined),
                tpEndDate: data.tpEndDate === null ? null : (data.tpEndDate ? new Date(data.tpEndDate) : undefined),
                companyId: data.companyId || undefined,
                vehicleNumber: data.vehicleNumber || undefined,
                make: data.make || undefined,
                model: data.model || undefined,
                registrationDate: data.registrationDate
                    ? new Date(data.registrationDate)
                    : data.registrationDate === null
                        ? null
                        : undefined,
                dealerId: data.dealerId || undefined,

                updatedBy: role,
            },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'UPDATE',
            entityType: 'lead',
            entityId: lead.id,
            title: `Lead Updated: ${lead.name}`,
            description: `Updated lead details for ${lead.name} (Status: ${lead.status})`,
            metadata: { leadId: lead.id, status: lead.status },
        });

        return lead;
    }

    async softDelete(userId: string, role: string, id: string) {
        await this.findById(userId, role, id);

        const lead = await prisma.lead.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        ActivityService.logActivity({
            userId,
            userRole: role,
            action: 'DELETE',
            entityType: 'lead',
            entityId: id,
            title: `Lead Deleted: ${lead.name}`,
            description: `Soft deleted lead record for ${lead.name}`,
            metadata: { leadId: id, name: lead.name },
        });

        return lead;
    }

    async convertToCustomer(
        userId: string,
        role: string,
        id: string,
        extra: { 
            address?: string; 
            email?: string; 
            policyOrigin?: string; 
            ncbPercentage?: number | null;
            policyNumber?: string;
            policyType?: PolicyType;
            companyId?: string;
            premiumAmount?: number;
            startDate?: string;
            expiryDate?: string;
            vehicleNumber?: string | null;
            make?: string | null;
            model?: string | null;
            registrationDate?: string | null;
            vehicleClass?: PolicyVehicleClass | null;
            idv?: number | null;
            od?: number | null;
            tp?: number | null;
            tax?: number | null;
            totalPremium?: number | null;
            dealerId?: string | null;
            tpStartDate?: string | null;
            tpEndDate?: string | null;
        }
    ) {
        const lead = await this.findById(userId, role, id);

        const policyNumber = extra.policyNumber;
        if (policyNumber) {
            const existingPolicy = await prisma.policy.findFirst({
                where: {
                    ...ownerFilter(userId, role),
                    policyNumber,
                    deletedAt: null,
                },
                include: { customer: true }
            });
            if (existingPolicy) {
                throw Object.assign(new Error(`Duplicate policy number: Customer "${existingPolicy.customer?.name}" already has policy number "${policyNumber}"`), { statusCode: 400 });
            }
        }

        // Check duplicate name and phone number combination (Block)
        if (lead.phone && lead.name) {
            const existingCustomer = await prisma.customer.findMany({
                where: {
                    ...ownerFilter(userId, role),
                    phone: lead.phone,
                    name: { equals: lead.name, mode: 'insensitive' },
                    deletedAt: null,
                },
                select: { name: true }
            });
            if (existingCustomer.length > 0) {
                throw Object.assign(
                    new Error(`Duplicate customer: "${lead.name}" with phone ${lead.phone} already exists`),
                    { statusCode: 400 }
                );
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Customer
            const customer = await tx.customer.create({
                data: {
                    userId,
                    name: lead.name,
                    phone: lead.phone,
                    email: extra.email,
                    address: extra.address,
                    createdBy: role,
                    updatedBy: role,
                },
            });

            // 2. Mark Lead as converted and clear nextFollowUpDate as it's now a Policy/Customer
            await tx.lead.update({
                where: { id },
                data: {
                    status: 'converted',
                    nextFollowUpDate: null,
                    updatedBy: role,
                },
            });

            // 3. Auto-create Policy and initial Payment if quote data exists
            const policyType = lead.policyType || extra.policyType;
            const companyId = lead.companyId || extra.companyId;
            const premiumAmount = lead.premiumAmount !== null ? lead.premiumAmount : extra.premiumAmount;
            
            const rawStartDate = lead.startDate || (extra.startDate ? new Date(extra.startDate) : null);
            const rawExpiryDate = lead.expiryDate || (extra.expiryDate ? new Date(extra.expiryDate) : null);
 
            if (policyType && premiumAmount !== undefined && premiumAmount !== null && rawStartDate && rawExpiryDate && companyId) {
                // --- Smart Premium Pre-calculation for Conversion ---
                const od = lead.od !== null ? Number(lead.od) : (extra.od !== undefined && extra.od !== null ? Number(extra.od) : 0);
                const tp = lead.tp !== null ? Number(lead.tp) : (extra.tp !== undefined && extra.tp !== null ? Number(extra.tp) : 0);
                const tax = lead.tax !== null ? Number(lead.tax) : (extra.tax !== undefined && extra.tax !== null ? Number(extra.tax) : 0);
                
                let finalNet = premiumAmount;
                let finalTotal = lead.totalPremium !== null ? lead.totalPremium : (extra.totalPremium !== undefined && extra.totalPremium !== null ? extra.totalPremium : 0);

                if (!finalNet && (od || tp)) {
                    finalNet = od + tp;
                }
                if (!finalTotal && (finalNet || tax)) {
                    finalTotal = finalNet + tax;
                }

                const startDate = new Date(rawStartDate);
                const expiryDate = new Date(rawExpiryDate);

                const policy = await tx.policy.create({
                    data: {
                        userId,
                        customerId: customer.id,
                        companyId,
                        policyType,
                        policyNumber: extra.policyNumber || null,
                        premiumAmount: finalNet,
                        startDate,
                        expiryDate,
                        noOfYears: Math.max(1, Math.round(Math.abs(expiryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365))),

                        // Motor fields
                        vehicleNumber: lead.vehicleNumber || extra.vehicleNumber || null,
                        make: lead.make || extra.make || null,
                        model: lead.model || extra.model || null,
                        registrationDate: lead.registrationDate || (extra.registrationDate ? new Date(extra.registrationDate) : null),
                        vehicleClass: lead.vehicleClass || extra.vehicleClass || null,
                        idv: lead.idv !== null ? lead.idv : (extra.idv ?? null),
                        od: od || null,
                        tp: tp || null,
                        tax: tax || null,
                        totalPremium: finalTotal || null,
                        dealerId: lead.dealerId || extra.dealerId || null,
                        policyOrigin: (extra.policyOrigin || lead.policyOrigin || 'fresh') as any,
                        ncbPercentage: extra.ncbPercentage ?? lead.ncbPercentage ?? null,
                        tpStartDate: lead.tpStartDate || (extra.tpStartDate ? new Date(extra.tpStartDate) : null),
                        tpEndDate: lead.tpEndDate || (extra.tpEndDate ? new Date(extra.tpEndDate) : null),

                        status: 'active',
                        createdBy: role,
                        updatedBy: role,
                    }
                });

                // Create initial payment record
                const fullPremium = finalTotal || finalNet;
                await tx.payment.create({
                    data: {
                        userId,
                        policyId: policy.id,
                        customerId: customer.id,
                        amount: fullPremium,
                        dueDate: policy.startDate, // Due on policy start
                        status: 'pending',
                        createdBy: role,
                    }
                });
            }

            ActivityService.logActivity({
                userId,
                userRole: role,
                action: 'CONVERT',
                entityType: 'lead',
                entityId: id,
                title: `Lead Converted: ${customer.name}`,
                description: `Lead converted to customer account for ${customer.name}`,
                metadata: { leadId: id, customerId: customer.id },
            });

            return customer;
        });

        return result;
    }
}

export const leadService = new LeadService();
