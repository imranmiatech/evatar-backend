import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const plainPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !plainPassword) {
        throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD is not set');
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            fullName: 'Super Admin',
            passwordHash: hashedPassword,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE
        },
    });

    console.log(`Admin user seeded: ${admin.email}`);
}