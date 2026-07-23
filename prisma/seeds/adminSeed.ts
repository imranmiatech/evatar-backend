import {
    MembershipPlan,
    PrismaClient,
    RelationshipType,
    UserRole,
    UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
    const adminEmail = process.env.ADMIN_EMAIL || 'a@e.com';
    const plainPassword = process.env.ADMIN_PASSWORD || '123456';

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            fullName: 'Super Admin',
            passwordHash: hashedPassword,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: adminEmail,
            fullName: 'Super Admin',
            passwordHash: hashedPassword,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
    });

    console.log(`Admin user seeded: ${admin.email}`);

    const parent = await prisma.user.upsert({
        where: { email: 'p@e.com' },
        update: {
            fullName: 'Parent User',
            passwordHash: hashedPassword,
            role: UserRole.PARENT,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: 'p@e.com',
            fullName: 'Parent User',
            passwordHash: hashedPassword,
            role: UserRole.PARENT,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
            parentProfile: {
                create: {
                    relationship: RelationshipType.FATHER,
                    address: 'London, UK',
                    street: 'Test Street',
                    postalCode: '12345',
                    city: 'London',
                    state: 'London',
                    country: 'UK',
                    membershipPlan: MembershipPlan.TRIAL,
                },
            },
        },
    });

    await prisma.parentProfile.upsert({
        where: { userId: parent.id },
        update: {
            relationship: RelationshipType.FATHER,
            address: 'London, UK',
            street: 'Test Street',
            postalCode: '12345',
            city: 'London',
            state: 'London',
            country: 'UK',
            membershipPlan: MembershipPlan.TRIAL,
        },
        create: {
            userId: parent.id,
            relationship: RelationshipType.FATHER,
            address: 'London, UK',
            street: 'Test Street',
            postalCode: '12345',
            city: 'London',
            state: 'London',
            country: 'UK',
            membershipPlan: MembershipPlan.TRIAL,
        },
    });
    console.log(`Parent user seeded: ${parent.email}`);

    const nanny = await prisma.user.upsert({
        where: { email: 'n@e.com' },
        update: {
            fullName: 'Nanny User',
            passwordHash: hashedPassword,
            role: UserRole.NANNY,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: 'n@e.com',
            fullName: 'Nanny User',
            passwordHash: hashedPassword,
            role: UserRole.NANNY,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
            nannyProfile: {
                create: {
                    headline: 'Experienced Nanny',
                    hourlyRateCents: 1500,
                    completedJobs: 10,
                },
            },
        },
    });

    await prisma.nannyProfile.upsert({
        where: { userId: nanny.id },
        update: {
            headline: 'Experienced Nanny',
            hourlyRateCents: 1500,
            completedJobs: 10,
        },
        create: {
            userId: nanny.id,
            headline: 'Experienced Nanny',
            hourlyRateCents: 1500,
            completedJobs: 10,
        },
    });
    console.log(`Nanny user seeded: ${nanny.email}`);
}
