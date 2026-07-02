import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const companies = [
    { name: 'New India Assurance', type: 'insurer', category: 'general' },
    { name: 'United India Insurance', type: 'insurer', category: 'general' },
    { name: 'Oriental Insurance', type: 'insurer', category: 'general' },
    { name: 'National Insurance', type: 'insurer', category: 'general' },
    { name: 'IFFCO Tokio', type: 'insurer', category: 'general' },
    { name: 'Reliance General Insurance', type: 'insurer', category: 'general' },
    { name: 'Cholamandalam MS', type: 'insurer', category: 'general' },
    { name: 'Royal Sundaram', type: 'insurer', category: 'general' },
    { name: 'HDFC Ergo', type: 'insurer', category: 'general' },
    { name: 'Shriram General Insurance', type: 'insurer', category: 'general' },
    { name: 'Bajaj Allianz', type: 'insurer', category: 'general' },
    { name: 'Tata AIG', type: 'insurer', category: 'general' },
    { name: 'Star Health Insurance', type: 'insurer', category: 'health' },
    { name: 'Care Insurance', type: 'insurer', category: 'health' },
    { name: 'LIC', type: 'insurer', category: 'life' }
];

async function main() {
    console.log('🌱 Seeding companies...');
    for (const company of companies) {
        await prisma.company.upsert({
            where: { id: company.name }, // Will fail on first run, handled by createMany below
            update: {},
            create: company,
        });
    }
    const companyCount = await prisma.company.count();
    console.log(`✅ Seeded ${companyCount} companies`);

    console.log('👤 Seeding default users...');
    const saltRounds = 12;
    
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const staffPassword = process.env.INITIAL_STAFF_PASSWORD;

    if (!adminPassword || !staffPassword) {
        throw new Error('Both INITIAL_ADMIN_PASSWORD and INITIAL_STAFF_PASSWORD environment variables are required.');
    }

    const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);
    const staffPasswordHash = await bcrypt.hash(staffPassword, saltRounds);

    // 1. Seed Agent (Owner/Admin)
    await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: {},
        create: {
            email: 'admin@gmail.com',
            name: 'Agent Owner',
            passwordHash: adminPasswordHash,
            role: 'agent',
        },
    });

    // 2. Seed Staff (Employee)
    await prisma.user.upsert({
        where: { email: 'staff@gmail.com' },
        update: {},
        create: {
            email: 'staff@gmail.com',
            name: 'Staff Member',
            passwordHash: staffPasswordHash,
            role: 'staff',
        },
    });

    console.log('✅ Seeded default users (admin@gmail.com & staff@gmail.com)');
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
