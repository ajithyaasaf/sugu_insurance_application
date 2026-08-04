import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const policies = await prisma.policy.findMany({
        where: {
            OR: [
                { customer: { name: { contains: 'BHARATHI B', mode: 'insensitive' } } },
                { vehicleNumber: { contains: 'TN59CD5582', mode: 'insensitive' } }
            ]
        },
        include: {
            customer: true,
            company: true
        }
    });
    console.log(JSON.stringify(policies, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
