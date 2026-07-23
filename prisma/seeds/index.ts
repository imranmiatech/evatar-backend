import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding users (Admin, Parent, Nanny)...');

  const passwordHash = await bcrypt.hash('123456', 10);
  const nannyAvatarUrls = {
    maya: 'https://i.pravatar.cc/120?img=47',
    arjun: 'https://i.pravatar.cc/120?img=12',
    kiran: 'https://i.pravatar.cc/120?img=32',
    tara: 'https://i.pravatar.cc/120?img=5',
  };

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'a@e.com' },
    update: {
      fullName: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
    },
    create: {
      email: 'a@e.com',
      fullName: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
    },
  });
  console.log(`Created admin: ${admin.email}`);

  // Parent
  const parent = await prisma.user.upsert({
    where: { email: 'p@e.com' },
    update: {
      fullName: 'Parent User',
      passwordHash,
      role: 'PARENT',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
    },
    create: {
      email: 'p@e.com',
      fullName: 'Parent User',
      passwordHash,
      role: 'PARENT',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
      parentProfile: {
        create: {
          relationType: 'Father',
          city: 'London',
          country: 'UK',
        },
      },
    },
  });
  await prisma.parentProfile.upsert({
    where: { userId: parent.id },
    update: {
      relationType: 'Father',
      city: 'London',
      country: 'UK',
    },
    create: {
      userId: parent.id,
      relationType: 'Father',
      city: 'London',
      country: 'UK',
    },
  });
  console.log(`Created parent: ${parent.email}`);

  // Nanny
  const nanny = await prisma.user.upsert({
    where: { email: 'n@e.com' },
    update: {
      fullName: 'Nanny User',
      passwordHash,
      role: 'NANNY',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
    },
    create: {
      email: 'n@e.com',
      fullName: 'Nanny User',
      passwordHash,
      role: 'NANNY',
      isActive: true,
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
  console.log(`Created nanny: ${nanny.email}`);

  const caregiverSeeds = [
    {
      email: 'maya.nanny@e.com',
      fullName: 'Maya',
      profilePictureUrl: nannyAvatarUrls.maya,
    },
    {
      email: 'arjun.nanny@e.com',
      fullName: 'Arjun',
      profilePictureUrl: nannyAvatarUrls.arjun,
    },
    {
      email: 'kiran.nanny@e.com',
      fullName: 'Kiran',
      profilePictureUrl: nannyAvatarUrls.kiran,
    },
    {
      email: 'tara.nanny@e.com',
      fullName: 'Tara',
      profilePictureUrl: nannyAvatarUrls.tara,
    },
  ];

  const caregivers = await Promise.all(
    caregiverSeeds.map((caregiver) =>
      prisma.user.upsert({
        where: { email: caregiver.email },
        update: {
          fullName: caregiver.fullName,
          passwordHash,
          role: 'NANNY',
          profilePictureUrl: caregiver.profilePictureUrl,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          verificationStatus: 'APPROVED',
        },
        create: {
          email: caregiver.email,
          fullName: caregiver.fullName,
          passwordHash,
          role: 'NANNY',
          profilePictureUrl: caregiver.profilePictureUrl,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          verificationStatus: 'APPROVED',
          nannyProfile: {
            create: {
              headline: 'Trusted Child Caregiver',
              hourlyRateCents: 1500,
              completedJobs: 12,
            },
          },
        },
      }),
    ),
  );

  for (const caregiver of caregivers) {
    await prisma.nannyProfile.upsert({
      where: { userId: caregiver.id },
      update: {
        headline: 'Trusted Child Caregiver',
        hourlyRateCents: 1500,
        completedJobs: 12,
      },
      create: {
        userId: caregiver.id,
        headline: 'Trusted Child Caregiver',
        hourlyRateCents: 1500,
        completedJobs: 12,
      },
    });
  }

  const caregiverByName = Object.fromEntries(
    caregivers.map((caregiver) => [caregiver.fullName, caregiver]),
  );

  const childSeeds = [
    {
      name: 'Eve Ahmed',
      avatar:
        'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?auto=format&fit=crop&w=240&q=80',
      birthDate: '2022-05-16',
      favoriteThings: ['Banana', 'Milk', 'Pancakes', 'Eggs', 'Strawberries'],
      personality:
        'Eve enjoys creative activities, responds positively to outdoor exploration, and shows strong interest in storytelling and imaginative play.',
      nannies: ['Maya', 'Arjun'],
    },
    {
      name: 'Liam Johnson',
      avatar:
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=240&q=80',
      birthDate: '2023-02-10',
      favoriteThings: ['Apple slices', 'Blocks', 'Story Time'],
      personality:
        'Liam is calm, curious, and happiest with visual stories and hands-on play.',
      nannies: ['Maya', 'Arjun'],
    },
    {
      name: 'Ava Patel',
      avatar:
        'https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?auto=format&fit=crop&w=240&q=80',
      birthDate: '2023-11-03',
      favoriteThings: ['Yogurt', 'Music', 'Outdoor Exploration'],
      personality:
        'Ava responds well to rhythm, gentle movement, and short sensory activities.',
      nannies: ['Maya', 'Arjun'],
    },
    {
      name: 'Noah Smith',
      avatar:
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=240&q=80',
      birthDate: '2021-06-19',
      favoriteThings: ['Drawing', 'Bubble Play', 'Pancakes'],
      personality:
        'Noah likes active play, visual prompts, and familiar routines with clear choices.',
      nannies: ['Kiran', 'Tara'],
    },
    {
      name: 'Sophia Brown',
      avatar:
        'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?auto=format&fit=crop&w=240&q=80',
      birthDate: '2025-03-07',
      favoriteThings: ['Milk', 'Soft books', 'Music'],
      personality:
        'Sophia enjoys warm caregiver interaction, songs, and gentle sensory play.',
      nannies: ['Maya', 'Arjun'],
    },
  ];

  for (const childSeed of childSeeds) {
    const existingChild = await prisma.child.findFirst({
      where: {
        parentUserId: parent.id,
        name: childSeed.name,
      },
    });

    const child = existingChild
      ? await prisma.child.update({
          where: { id: existingChild.id },
          data: {
            avatar: childSeed.avatar,
            birthDate: new Date(childSeed.birthDate),
            favoriteThings: childSeed.favoriteThings,
            personality: childSeed.personality,
          },
        })
      : await prisma.child.create({
          data: {
            parentUserId: parent.id,
            name: childSeed.name,
            avatar: childSeed.avatar,
            birthDate: new Date(childSeed.birthDate),
            favoriteThings: childSeed.favoriteThings,
            personality: childSeed.personality,
          },
        });

    for (const nannyName of childSeed.nannies) {
      const caregiver = caregiverByName[nannyName];

      if (!caregiver) {
        continue;
      }

      await prisma.nannyChildLink.upsert({
        where: {
          nannyUserId_childId: {
            nannyUserId: caregiver.id,
            childId: child.id,
          },
        },
        update: {
          canViewStory: true,
          canUpdateProof: true,
        },
        create: {
          nannyUserId: caregiver.id,
          childId: child.id,
          canViewStory: true,
          canUpdateProof: true,
        },
      });
    }

    await seedChildProfileTabs(parent.id, child.id, childSeed.name);
  }

  console.log(`Seeded ${childSeeds.length} children for ${parent.email}`);

  console.log('Seeding completed.');
}

async function seedChildProfileTabs(
  parentUserId: string,
  childId: string,
  childName: string,
) {
  const memoryImages = [
    'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1491013516836-7db643ee125a?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1606418470116-2cbbf0f7d5e7?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1524503033411-c9566986fc8f?auto=format&fit=crop&w=480&q=80',
    'https://images.unsplash.com/photo-1540479859555-17af45c78602?auto=format&fit=crop&w=480&q=80',
  ];

  const storyCovers = [
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=640&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80',
    'https://images.unsplash.com/photo-1476231682828-37e571bc172f?auto=format&fit=crop&w=640&q=80',
  ];
  const childSlug = childName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const storyTitles = [
    'The Brave Little Elephant',
    'The Garden Adventure',
    'The Moonlit Blanket Fort',
  ];
  const oldTemplatePrefix =
    childName === 'Eve Ahmed' ? 'seed-eve-memory-' : undefined;

  await prisma.dayActivity.deleteMany({
    where: {
      dayPlan: { childId },
      OR: [
        { templateId: { startsWith: `seed-${childSlug}-memory-` } },
        ...(oldTemplatePrefix
          ? [{ templateId: { startsWith: oldTemplatePrefix } }]
          : []),
      ],
    },
  });

  for (let index = 0; index < 12; index += 1) {
    const date = new Date(Date.UTC(2026, 6, 22 - index));
    const plan = await prisma.dayPlan.upsert({
      where: {
        childId_date: {
          childId,
          date,
        },
      },
      update: {
        title: `${childName}'s Day ${index + 1}`,
        status: 'READY',
        mode: 'MANUAL',
      },
      create: {
        childId,
        date,
        mode: 'MANUAL',
        status: 'READY',
        title: `${childName}'s Day ${index + 1}`,
        createdByUserId: parentUserId,
      },
    });

    const templateId = `seed-${childSlug}-memory-${index + 1}`;

    await prisma.dayActivity.create({
      data: {
        dayPlanId: plan.id,
        category: 'Memory',
        title: `Memory ${index + 1}`,
        description: `A captured moment from ${childName}'s day.`,
        status: 'COMPLETED',
        imageUrl: memoryImages[index],
        templateId,
        sortOrder: index,
      },
    });

    await prisma.bedtimeStory.upsert({
      where: {
        dayPlanId: plan.id,
      },
      update: {
        title: storyTitles[index % storyTitles.length],
        storyText: `Tonight ${childName} follows a gentle path through a bright story world, learning courage, kindness, and calm before sleep.`,
        coverImageUrl: storyCovers[index % storyCovers.length],
        parentAudioUrl:
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        audioDurationSec: 82 + index,
      },
      create: {
        dayPlanId: plan.id,
        title: storyTitles[index % storyTitles.length],
        storyText: `Tonight ${childName} follows a gentle path through a bright story world, learning courage, kindness, and calm before sleep.`,
        coverImageUrl: storyCovers[index % storyCovers.length],
        parentAudioUrl:
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        audioDurationSec: 82 + index,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
