import { hash, genSalt } from '@node-rs/bcrypt';
import cuid2 from '@paralleldrive/cuid2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function createIdipAdmin(prisma: PrismaClient): Promise<void> {
	const email = process.env['ADMIN_EMAIL'];
	const password = process.env['ADMIN_PASSWORD'];
	if (!email || !password) {
		console.error('❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment');
		return;
	}
	try {
		const salt = await genSalt(9);
		const hashedPassword = await hash(password, undefined, salt);
		const admin = await prisma.admin.upsert({
			where: { email },
			create: {
				id: cuid2.createId(),
				name: 'Idip Admin',
				email,
				password: hashedPassword,
			},
			update: {
				password: hashedPassword,
			},
		});
		console.log(`✅ Admin created/updated: ${admin.email}`);
	} catch (error) {
		console.error('❌ Failed to create admin:', error);
		throw error;
	}
}

async function main() {
	const databaseUrl = process.env['DATABASE_URL'];
	if (!databaseUrl) {
		console.error('❌ Missing DATABASE_URL in environment');
		process.exit(1);
	}

	const pool = new PrismaPg({
		connectionString: databaseUrl,
	});

	const prisma = new PrismaClient({
		adapter: pool,
		log: ['error', 'warn'],
	});

	try {
		console.log('🌱 Starting database seed...');
		await createIdipAdmin(prisma);
		console.log('✅ Database seed completed!');
	} catch (error) {
		console.error('❌ Seed failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
