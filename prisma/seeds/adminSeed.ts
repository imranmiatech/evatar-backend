import {
  DayOfWeek,
  Gender,
  HealthCondition,
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

  const deleteTestParent = await prisma.user.upsert({
    where: { email: 'p1@e.com' },
    update: {
      fullName: 'Delete Test Parent',
      passwordHash: hashedPassword,
      role: UserRole.PARENT,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
    },
    create: {
      email: 'p1@e.com',
      fullName: 'Delete Test Parent',
      passwordHash: hashedPassword,
      role: UserRole.PARENT,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
      parentProfile: {
        create: {
          relationship: RelationshipType.FATHER,
          address: 'Delete Test Address',
          street: 'Delete Test Street',
          postalCode: '00000',
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          membershipPlan: MembershipPlan.TRIAL,
        },
      },
    },
  });

  await prisma.parentProfile.upsert({
    where: { userId: deleteTestParent.id },
    update: {
      relationship: RelationshipType.FATHER,
      address: 'Delete Test Address',
      street: 'Delete Test Street',
      postalCode: '00000',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      membershipPlan: MembershipPlan.TRIAL,
    },
    create: {
      userId: deleteTestParent.id,
      relationship: RelationshipType.FATHER,
      address: 'Delete Test Address',
      street: 'Delete Test Street',
      postalCode: '00000',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      membershipPlan: MembershipPlan.TRIAL,
    },
  });
  console.log(`Delete test parent user seeded: ${deleteTestParent.email}`);

  const extraParents = [
    {
      email: 'parent1@e.com',
      fullName: 'Test Parent One',
      relationship: RelationshipType.MOTHER,
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
      relationship: RelationshipType.FATHER,
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
      relationship: RelationshipType.GUARDIAN,
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
        role: UserRole.PARENT,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationStatus: 'APPROVED',
      },
      create: {
        email: parentSeed.email,
        fullName: parentSeed.fullName,
        passwordHash: hashedPassword,
        role: UserRole.PARENT,
        status: UserStatus.ACTIVE,
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
            membershipPlan: MembershipPlan.TRIAL,
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
        membershipPlan: MembershipPlan.TRIAL,
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
        membershipPlan: MembershipPlan.TRIAL,
      },
    });

    console.log(`Extra parent user seeded: ${seededParent.email}`);
  }

  const childSeeds = [
    {
      name: 'Eve',
      gender: Gender.GIRL,
      birthDate: new Date('2021-05-12'),
      weight: '15 kg',
      avatar: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9',
      wakeUpTime: '07:00',
      bedTime: '20:30',
      healthConditions: [HealthCondition.NONE],
      additionalNotes:
        'Enjoys picture books, pretend play, and gentle outdoor activities.',
      schoolSchedule: {
        days: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU],
        startTime: '09:00',
        endTime: '12:30',
      },
      recurringActivities: [
        {
          name: 'Story time',
          days: [DayOfWeek.MON, DayOfWeek.WED],
          startTime: '16:00',
          endTime: '16:30',
        },
        {
          name: 'Outdoor play',
          days: [DayOfWeek.TUE, DayOfWeek.THU],
          startTime: '17:00',
          endTime: '17:45',
        },
      ],
      naps: [{ startTime: '13:30', endTime: '14:30' }],
    },
    {
      name: 'Maya',
      gender: Gender.GIRL,
      birthDate: new Date('2019-09-03'),
      weight: '19 kg',
      avatar: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb',
      wakeUpTime: '06:45',
      bedTime: '20:15',
      healthConditions: [HealthCondition.FOOD_ALLERGIES],
      additionalNotes:
        'Avoid peanuts. Likes music, drawing, and helping with simple meal prep.',
      schoolSchedule: {
        days: [
          DayOfWeek.MON,
          DayOfWeek.TUE,
          DayOfWeek.WED,
          DayOfWeek.THU,
          DayOfWeek.FRI,
        ],
        startTime: '08:30',
        endTime: '13:00',
      },
      recurringActivities: [
        {
          name: 'Drawing practice',
          days: [DayOfWeek.MON, DayOfWeek.FRI],
          startTime: '15:30',
          endTime: '16:15',
        },
        {
          name: 'Music and movement',
          days: [DayOfWeek.WED],
          startTime: '17:00',
          endTime: '17:30',
        },
      ],
      naps: [],
    },
    {
      name: 'Noah',
      gender: Gender.BOY,
      birthDate: new Date('2022-11-18'),
      weight: '12 kg',
      avatar: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4',
      wakeUpTime: '07:30',
      bedTime: '19:45',
      healthConditions: [HealthCondition.NONE],
      additionalNotes:
        'Needs a calm transition before nap time. Loves blocks and sensory play.',
      schoolSchedule: {
        days: [DayOfWeek.TUE, DayOfWeek.THU],
        startTime: '10:00',
        endTime: '12:00',
      },
      recurringActivities: [
        {
          name: 'Sensory bin play',
          days: [DayOfWeek.MON, DayOfWeek.WED],
          startTime: '10:30',
          endTime: '11:00',
        },
        {
          name: 'Block building',
          days: [DayOfWeek.FRI],
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
      gender: Gender.BOY,
      birthDate: new Date('2018-02-24'),
      weight: '23 kg',
      avatar: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4',
      wakeUpTime: '06:30',
      bedTime: '21:00',
      healthConditions: [HealthCondition.MOBILITY_CONSIDERATIONS],
      additionalNotes:
        'Prefers structured tasks and short activity blocks with breaks.',
      schoolSchedule: {
        days: [
          DayOfWeek.MON,
          DayOfWeek.TUE,
          DayOfWeek.WED,
          DayOfWeek.THU,
          DayOfWeek.FRI,
        ],
        startTime: '08:00',
        endTime: '14:30',
      },
      recurringActivities: [
        {
          name: 'Reading practice',
          days: [DayOfWeek.MON, DayOfWeek.WED, DayOfWeek.FRI],
          startTime: '18:00',
          endTime: '18:25',
        },
        {
          name: 'Gentle stretching',
          days: [DayOfWeek.TUE, DayOfWeek.THU],
          startTime: '17:30',
          endTime: '17:45',
        },
      ],
      naps: [],
    },
    {
      name: 'Ava',
      gender: Gender.GIRL,
      birthDate: new Date('2020-07-08'),
      weight: '17 kg',
      avatar: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74',
      wakeUpTime: '07:15',
      bedTime: '20:00',
      healthConditions: [HealthCondition.NONE],
      additionalNotes:
        'Loves recipes, puzzles, and garden walks. Responds well to visual routines.',
      schoolSchedule: {
        days: [DayOfWeek.MON, DayOfWeek.WED, DayOfWeek.FRI],
        startTime: '09:15',
        endTime: '12:15',
      },
      recurringActivities: [
        {
          name: 'Puzzle time',
          days: [DayOfWeek.TUE, DayOfWeek.THU],
          startTime: '15:45',
          endTime: '16:20',
        },
        {
          name: 'Garden walk',
          days: [DayOfWeek.SAT],
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

    const { schoolSchedule, recurringActivities, naps, ...childData } =
      childSeed;

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
        role: UserRole.NANNY,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationStatus: 'APPROVED',
      },
      create: {
        email: nannySeed.email,
        fullName: nannySeed.fullName,
        passwordHash: hashedPassword,
        role: UserRole.NANNY,
        status: UserStatus.ACTIVE,
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
