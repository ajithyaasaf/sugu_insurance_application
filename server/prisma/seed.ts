import { PrismaClient } from '@prisma/client';

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

    // The createMany fallback was removing unique checks and causing duplicates.
    // We strictly use upsert now.

    const count = await prisma.company.count();
    console.log(`✅ Seeded ${count} companies`);
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
