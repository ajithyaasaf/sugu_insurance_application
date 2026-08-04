import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const policies = await prisma.policy.findMany({ 
        where: { vehicleNumber: 'TN59BK6599' }, 
        include: { parentPolicy: true, renewals: true } 
    });
    console.log(JSON.stringify(policies, null, 2));
}
main().finally(() => prisma.$disconnect());
