"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = seedAdmin;
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
async function seedAdmin(prisma) {
    const adminEmail = process.env.ADMIN_EMAIL || 'a@e.com';
    const plainPassword = process.env.ADMIN_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            fullName: 'Super Admin',
            passwordHash: hashedPassword,
            role: client_1.UserRole.ADMIN,
            status: client_1.UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: adminEmail,
            fullName: 'Super Admin',
            passwordHash: hashedPassword,
            role: client_1.UserRole.ADMIN,
            status: client_1.UserStatus.ACTIVE,
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
            role: client_1.UserRole.PARENT,
            status: client_1.UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: 'p@e.com',
            fullName: 'Parent User',
            passwordHash: hashedPassword,
            role: client_1.UserRole.PARENT,
            status: client_1.UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
            parentProfile: {
                create: {
                    relationship: client_1.RelationshipType.FATHER,
                    address: 'London, UK',
                    street: 'Test Street',
                    postalCode: '12345',
                    city: 'London',
                    state: 'London',
                    country: 'UK',
                    membershipPlan: client_1.MembershipPlan.TRIAL,
                },
            },
        },
    });
    await prisma.parentProfile.upsert({
        where: { userId: parent.id },
        update: {
            relationship: client_1.RelationshipType.FATHER,
            address: 'London, UK',
            street: 'Test Street',
            postalCode: '12345',
            city: 'London',
            state: 'London',
            country: 'UK',
            membershipPlan: client_1.MembershipPlan.TRIAL,
        },
        create: {
            userId: parent.id,
            relationship: client_1.RelationshipType.FATHER,
            address: 'London, UK',
            street: 'Test Street',
            postalCode: '12345',
            city: 'London',
            state: 'London',
            country: 'UK',
            membershipPlan: client_1.MembershipPlan.TRIAL,
        },
    });
    console.log(`Parent user seeded: ${parent.email}`);
    const deleteTestParent = await prisma.user.upsert({
        where: { email: 'p1@e.com' },
        update: {
            fullName: 'Delete Test Parent',
            passwordHash: hashedPassword,
            role: client_1.UserRole.PARENT,
            status: client_1.UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: 'p1@e.com',
            fullName: 'Delete Test Parent',
            passwordHash: hashedPassword,
            role: client_1.UserRole.PARENT,
            status: client_1.UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
            parentProfile: {
                create: {
                    relationship: client_1.RelationshipType.FATHER,
                    address: 'Delete Test Address',
                    street: 'Delete Test Street',
                    postalCode: '00000',
                    city: 'Test City',
                    state: 'Test State',
                    country: 'Test Country',
                    membershipPlan: client_1.MembershipPlan.TRIAL,
                },
            },
        },
    });
    await prisma.parentProfile.upsert({
        where: { userId: deleteTestParent.id },
        update: {
            relationship: client_1.RelationshipType.FATHER,
            address: 'Delete Test Address',
            street: 'Delete Test Street',
            postalCode: '00000',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            membershipPlan: client_1.MembershipPlan.TRIAL,
        },
        create: {
            userId: deleteTestParent.id,
            relationship: client_1.RelationshipType.FATHER,
            address: 'Delete Test Address',
            street: 'Delete Test Street',
            postalCode: '00000',
            city: 'Test City',
            state: 'Test State',
            country: 'Test Country',
            membershipPlan: client_1.MembershipPlan.TRIAL,
        },
    });
    console.log(`Delete test parent user seeded: ${deleteTestParent.email}`);
    const extraParents = [
        {
            email: 'parent1@e.com',
            fullName: 'Test Parent One',
            relationship: client_1.RelationshipType.MOTHER,
            address: 'House 11, Test Road, Dhaka',
            street: 'Test Road 11',
            postalCode: '1207',
            city: 'Dhaka',
            state: 'Dhaka',
            country: 'Bangladesh',
        },
        {
            email: 'parent2@e.com',
            fullName: 'Test Parent Two',
            relationship: client_1.RelationshipType.FATHER,
            address: 'House 22, Family Street, Dhaka',
            street: 'Family Street 22',
            postalCode: '1212',
            city: 'Dhaka',
            state: 'Dhaka',
            country: 'Bangladesh',
        },
        {
            email: 'parent3@e.com',
            fullName: 'Test Parent Three',
            relationship: client_1.RelationshipType.GUARDIAN,
            address: 'House 33, Care Avenue, Dhaka',
            street: 'Care Avenue 33',
            postalCode: '1216',
            city: 'Dhaka',
            state: 'Dhaka',
            country: 'Bangladesh',
        },
    ];
    for (const parentSeed of extraParents) {
        const seededParent = await prisma.user.upsert({
            where: { email: parentSeed.email },
            update: {
                fullName: parentSeed.fullName,
                passwordHash: hashedPassword,
                role: client_1.UserRole.PARENT,
                status: client_1.UserStatus.ACTIVE,
                isEmailVerified: true,
                isPhoneVerified: true,
                verificationStatus: 'APPROVED',
            },
            create: {
                email: parentSeed.email,
                fullName: parentSeed.fullName,
                passwordHash: hashedPassword,
                role: client_1.UserRole.PARENT,
                status: client_1.UserStatus.ACTIVE,
                isEmailVerified: true,
                isPhoneVerified: true,
                verificationStatus: 'APPROVED',
                parentProfile: {
                    create: {
                        relationship: parentSeed.relationship,
                        address: parentSeed.address,
                        street: parentSeed.street,
                        postalCode: parentSeed.postalCode,
                        city: parentSeed.city,
                        state: parentSeed.state,
                        country: parentSeed.country,
                        membershipPlan: client_1.MembershipPlan.TRIAL,
                    },
                },
            },
        });
        await prisma.parentProfile.upsert({
            where: { userId: seededParent.id },
            update: {
                relationship: parentSeed.relationship,
                address: parentSeed.address,
                street: parentSeed.street,
                postalCode: parentSeed.postalCode,
                city: parentSeed.city,
                state: parentSeed.state,
                country: parentSeed.country,
                membershipPlan: client_1.MembershipPlan.TRIAL,
            },
            create: {
                userId: seededParent.id,
                relationship: parentSeed.relationship,
                address: parentSeed.address,
                street: parentSeed.street,
                postalCode: parentSeed.postalCode,
                city: parentSeed.city,
                state: parentSeed.state,
                country: parentSeed.country,
                membershipPlan: client_1.MembershipPlan.TRIAL,
            },
        });
        console.log(`Extra parent user seeded: ${seededParent.email}`);
    }
    const childSeeds = [
        {
            name: 'Eve',
            gender: client_1.Gender.GIRL,
            birthDate: new Date('2021-05-12'),
            weight: '15 kg',
            avatar: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9',
            wakeUpTime: '07:00',
            bedTime: '20:30',
            healthConditions: [client_1.HealthCondition.NONE],
            additionalNotes: 'Enjoys picture books, pretend play, and gentle outdoor activities.',
            schoolSchedule: {
                days: [client_1.DayOfWeek.MON, client_1.DayOfWeek.TUE, client_1.DayOfWeek.WED, client_1.DayOfWeek.THU],
                startTime: '09:00',
                endTime: '12:30',
            },
            recurringActivities: [
                {
                    name: 'Story time',
                    days: [client_1.DayOfWeek.MON, client_1.DayOfWeek.WED],
                    startTime: '16:00',
                    endTime: '16:30',
                },
                {
                    name: 'Outdoor play',
                    days: [client_1.DayOfWeek.TUE, client_1.DayOfWeek.THU],
                    startTime: '17:00',
                    endTime: '17:45',
                },
            ],
            naps: [{ startTime: '13:30', endTime: '14:30' }],
        },
        {
            name: 'Maya',
            gender: client_1.Gender.GIRL,
            birthDate: new Date('2019-09-03'),
            weight: '19 kg',
            avatar: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb',
            wakeUpTime: '06:45',
            bedTime: '20:15',
            healthConditions: [client_1.HealthCondition.FOOD_ALLERGIES],
            additionalNotes: 'Avoid peanuts. Likes music, drawing, and helping with simple meal prep.',
            schoolSchedule: {
                days: [
                    client_1.DayOfWeek.MON,
                    client_1.DayOfWeek.TUE,
                    client_1.DayOfWeek.WED,
                    client_1.DayOfWeek.THU,
                    client_1.DayOfWeek.FRI,
                ],
                startTime: '08:30',
                endTime: '13:00',
            },
            recurringActivities: [
                {
                    name: 'Drawing practice',
                    days: [client_1.DayOfWeek.MON, client_1.DayOfWeek.FRI],
                    startTime: '15:30',
                    endTime: '16:15',
                },
                {
                    name: 'Music and movement',
                    days: [client_1.DayOfWeek.WED],
                    startTime: '17:00',
                    endTime: '17:30',
                },
            ],
            naps: [],
        },
        {
            name: 'Noah',
            gender: client_1.Gender.BOY,
            birthDate: new Date('2022-11-18'),
            weight: '12 kg',
            avatar: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4',
            wakeUpTime: '07:30',
            bedTime: '19:45',
            healthConditions: [client_1.HealthCondition.NONE],
            additionalNotes: 'Needs a calm transition before nap time. Loves blocks and sensory play.',
            schoolSchedule: {
                days: [client_1.DayOfWeek.TUE, client_1.DayOfWeek.THU],
                startTime: '10:00',
                endTime: '12:00',
            },
            recurringActivities: [
                {
                    name: 'Sensory bin play',
                    days: [client_1.DayOfWeek.MON, client_1.DayOfWeek.WED],
                    startTime: '10:30',
                    endTime: '11:00',
                },
                {
                    name: 'Block building',
                    days: [client_1.DayOfWeek.FRI],
                    startTime: '16:00',
                    endTime: '16:30',
                },
            ],
            naps: [
                { startTime: '11:45', endTime: '12:30' },
                { startTime: '15:00', endTime: '16:00' },
            ],
        },
        {
            name: 'Liam',
            gender: client_1.Gender.BOY,
            birthDate: new Date('2018-02-24'),
            weight: '23 kg',
            avatar: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4',
            wakeUpTime: '06:30',
            bedTime: '21:00',
            healthConditions: [client_1.HealthCondition.MOBILITY_CONSIDERATIONS],
            additionalNotes: 'Prefers structured tasks and short activity blocks with breaks.',
            schoolSchedule: {
                days: [
                    client_1.DayOfWeek.MON,
                    client_1.DayOfWeek.TUE,
                    client_1.DayOfWeek.WED,
                    client_1.DayOfWeek.THU,
                    client_1.DayOfWeek.FRI,
                ],
                startTime: '08:00',
                endTime: '14:30',
            },
            recurringActivities: [
                {
                    name: 'Reading practice',
                    days: [client_1.DayOfWeek.MON, client_1.DayOfWeek.WED, client_1.DayOfWeek.FRI],
                    startTime: '18:00',
                    endTime: '18:25',
                },
                {
                    name: 'Gentle stretching',
                    days: [client_1.DayOfWeek.TUE, client_1.DayOfWeek.THU],
                    startTime: '17:30',
                    endTime: '17:45',
                },
            ],
            naps: [],
        },
        {
            name: 'Ava',
            gender: client_1.Gender.GIRL,
            birthDate: new Date('2020-07-08'),
            weight: '17 kg',
            avatar: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74',
            wakeUpTime: '07:15',
            bedTime: '20:00',
            healthConditions: [client_1.HealthCondition.NONE],
            additionalNotes: 'Loves recipes, puzzles, and garden walks. Responds well to visual routines.',
            schoolSchedule: {
                days: [client_1.DayOfWeek.MON, client_1.DayOfWeek.WED, client_1.DayOfWeek.FRI],
                startTime: '09:15',
                endTime: '12:15',
            },
            recurringActivities: [
                {
                    name: 'Puzzle time',
                    days: [client_1.DayOfWeek.TUE, client_1.DayOfWeek.THU],
                    startTime: '15:45',
                    endTime: '16:20',
                },
                {
                    name: 'Garden walk',
                    days: [client_1.DayOfWeek.SAT],
                    startTime: '10:00',
                    endTime: '10:45',
                },
            ],
            naps: [{ startTime: '13:00', endTime: '14:00' }],
        },
    ];
    for (const childSeed of childSeeds) {
        const existingChild = await prisma.child.findFirst({
            where: {
                parentUserId: parent.id,
                name: childSeed.name,
            },
            select: { id: true },
        });
        const { schoolSchedule, recurringActivities, naps, ...childData } = childSeed;
        const child = existingChild
            ? await prisma.child.update({
                where: { id: existingChild.id },
                data: {
                    ...childData,
                    schoolSchedule: {
                        upsert: {
                            create: schoolSchedule,
                            update: schoolSchedule,
                        },
                    },
                    recurringActivities: {
                        deleteMany: {},
                        create: recurringActivities,
                    },
                    naps: {
                        deleteMany: {},
                        create: naps,
                    },
                },
            })
            : await prisma.child.create({
                data: {
                    parentUserId: parent.id,
                    ...childData,
                    schoolSchedule: {
                        create: schoolSchedule,
                    },
                    recurringActivities: {
                        create: recurringActivities,
                    },
                    naps: {
                        create: naps,
                    },
                },
            });
        console.log(`Child seeded for ${parent.email}: ${child.name}`);
    }
    const nanny = await prisma.user.upsert({
        where: { email: 'n@e.com' },
        update: {
            fullName: 'Nanny User',
            passwordHash: hashedPassword,
            role: client_1.UserRole.NANNY,
            status: client_1.UserStatus.ACTIVE,
            isEmailVerified: true,
            isPhoneVerified: true,
            verificationStatus: 'APPROVED',
        },
        create: {
            email: 'n@e.com',
            fullName: 'Nanny User',
            passwordHash: hashedPassword,
            role: client_1.UserRole.NANNY,
            status: client_1.UserStatus.ACTIVE,
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
    const extraNannies = [
        {
            email: 'imran32472@gmail.com',
            fullName: 'Imran Nanny',
            headline: 'Professional Childcare Specialist',
            hourlyRateCents: 1500,
            completedJobs: 12,
            yearsExperience: 5,
            skills: ['Child safety', 'Daily routines', 'Play learning', 'First aid'],
        },
        {
            email: 'nanny1@e.com',
            fullName: 'Test Nanny One',
            headline: 'Infant Care Specialist',
            hourlyRateCents: 1200,
            completedJobs: 8,
            yearsExperience: 3,
            skills: ['Infant care', 'Meal prep', 'Daily routines'],
        },
        {
            email: 'nanny2@e.com',
            fullName: 'Test Nanny Two',
            headline: 'Play & Learning Nanny',
            hourlyRateCents: 1400,
            completedJobs: 14,
            yearsExperience: 5,
            skills: ['Play learning', 'Homework help', 'Outdoor activities'],
        },
        {
            email: 'nanny3@e.com',
            fullName: 'Test Nanny Three',
            headline: 'Family Care Assistant',
            hourlyRateCents: 1600,
            completedJobs: 20,
            yearsExperience: 7,
            skills: ['First aid', 'Child safety', 'Sleep routines'],
        },
    ];
    for (const nannySeed of extraNannies) {
        const seededNanny = await prisma.user.upsert({
            where: { email: nannySeed.email },
            update: {
                fullName: nannySeed.fullName,
                passwordHash: hashedPassword,
                role: client_1.UserRole.NANNY,
                status: client_1.UserStatus.ACTIVE,
                isEmailVerified: true,
                isPhoneVerified: true,
                verificationStatus: 'APPROVED',
            },
            create: {
                email: nannySeed.email,
                fullName: nannySeed.fullName,
                passwordHash: hashedPassword,
                role: client_1.UserRole.NANNY,
                status: client_1.UserStatus.ACTIVE,
                isEmailVerified: true,
                isPhoneVerified: true,
                verificationStatus: 'APPROVED',
                nannyProfile: {
                    create: {
                        headline: nannySeed.headline,
                        hourlyRateCents: nannySeed.hourlyRateCents,
                        completedJobs: nannySeed.completedJobs,
                        yearsExperience: nannySeed.yearsExperience,
                        skills: nannySeed.skills,
                        languages: ['English', 'Bangla'],
                    },
                },
            },
        });
        await prisma.nannyProfile.upsert({
            where: { userId: seededNanny.id },
            update: {
                headline: nannySeed.headline,
                hourlyRateCents: nannySeed.hourlyRateCents,
                completedJobs: nannySeed.completedJobs,
                yearsExperience: nannySeed.yearsExperience,
                skills: nannySeed.skills,
                languages: ['English', 'Bangla'],
            },
            create: {
                userId: seededNanny.id,
                headline: nannySeed.headline,
                hourlyRateCents: nannySeed.hourlyRateCents,
                completedJobs: nannySeed.completedJobs,
                yearsExperience: nannySeed.yearsExperience,
                skills: nannySeed.skills,
                languages: ['English', 'Bangla'],
            },
        });
        console.log(`Extra nanny user seeded: ${seededNanny.email}`);
    }
}
//# sourceMappingURL=adminSeed.js.map