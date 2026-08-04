import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const policies = await prisma.policy.findMany({
        where: {
            OR: [
                { vehicleNumber: 'TN69AY3391' },
                { customer: { name: { contains: 'RAJESH P', mode: 'insensitive' } } }
            ]
        },
        include: {
            customer: true,
            parentPolicy: true,
            renewals: true
        }
    });
    console.log(JSON.stringify(policies.map(p => ({
        id: p.id,
        policyNumber: p.policyNumber,
        customerId: p.customerId,
        customerName: p.customer?.name,
        vehicleNumber: p.vehicleNumber,
        parentPolicyId: p.parentPolicyId,
        parentPolicyNumber: p.parentPolicy?.policyNumber,
        status: p.status,
        deletedAt: p.deletedAt,
        renewalsCount: p.renewals.length,
        renewals: p.renewals.map(r => ({ id: r.id, policyNumber: r.policyNumber, deletedAt: r.deletedAt, status: r.status }))
    })), null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
