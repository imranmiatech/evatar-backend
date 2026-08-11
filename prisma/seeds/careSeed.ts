import {
  CareModuleAdminStatus,
  CareModuleAssignmentStatus,
  CareModuleCategory,
  CareQuestionType,
  ActivityStatus,
  ChildMood,
  DayPlanBuildMode,
  DayPlanStatus,
  MediaType,
  Prisma,
  PrismaClient,
  TaskCompletionRate,
  TaskEnjoymentLevel,
} from '@prisma/client';

type CareQuestionSeed = {
  question: string;
  explanation: string;
  options: string[];
  correctIndex: number;
};

type CareModuleSeed = {
  title: string;
  subtitle: string;
  description: string;
  coverImageUrl: string;
  category: CareModuleCategory;
  estimatedMinutes: number;
  coinReward: number;
  suggestedMinAgeYears: number;
  suggestedMaxAgeYears: number;
  keyTakeaway: string;
  contentSections: Prisma.InputJsonValue;
  questions: CareQuestionSeed[];
};

const careModules: CareModuleSeed[] = [
  {
    title: "Handling child's behavior",
    subtitle: 'Understanding emotional regulation and response strategies',
    description:
      'Learn calm, practical ways to respond to tantrums, limits, and big feelings.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.CHILD_DEVELOPMENT,
    estimatedMinutes: 130,
    coinReward: 15,
    suggestedMinAgeYears: 2,
    suggestedMaxAgeYears: 6,
    keyTakeaway:
      'Behavior is communication. Respond to the need before correcting the action.',
    contentSections: [
      {
        heading: 'Real-life situation',
        body: 'A child shouts, refuses a routine, or melts down when a preferred activity ends.',
      },
      {
        heading: "What's happening",
        body: 'Young children are still building impulse control, language, and emotional regulation.',
      },
      {
        heading: 'Care response',
        bullets: [
          'Stay calm and lower your voice',
          'Name the feeling before setting the limit',
          'Offer two simple choices',
          'Reconnect after the child settles',
        ],
      },
    ],
    questions: [
      {
        question: 'What should a caregiver do first during a meltdown?',
        explanation:
          'A calm adult response helps the child co-regulate before problem-solving can happen.',
        options: [
          'Stay calm and acknowledge the feeling',
          'Raise their voice so the child listens',
          'Remove all choices for the rest of the day',
        ],
        correctIndex: 0,
      },
      {
        question: 'Behavior in young children is often a form of communication.',
        explanation:
          'Children often show unmet needs through behavior before they can explain them clearly.',
        options: ['True', 'False'],
        correctIndex: 0,
      },
      {
        question: 'Which response supports healthy boundaries?',
        explanation:
          'Gentle, clear, repeated limits help children feel secure while learning expectations.',
        options: [
          'Changing rules every time',
          'Clear limits with warm connection',
          'Ignoring every difficult behavior',
        ],
        correctIndex: 1,
      },
      {
        question: 'What helps a child move from resistance to cooperation?',
        explanation:
          'Small choices give children a sense of agency without removing the caregiver boundary.',
        options: [
          'Offer two acceptable choices',
          'Ask many open-ended questions',
          'Delay the routine indefinitely',
        ],
        correctIndex: 0,
      },
      {
        question: 'What should happen after the child settles?',
        explanation:
          'Repair and reconnection teach safety and reflection after emotional stress.',
        options: ['Reconnect briefly', 'Restart the argument', 'Avoid the child'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'How to feed a baby',
    subtitle: 'Safe, responsive feeding for infants and toddlers',
    description:
      'Support healthy feeding with safe textures, steady routines, and responsive cues.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.NUTRITION_FEEDING,
    estimatedMinutes: 113,
    coinReward: 15,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 3,
    keyTakeaway:
      'Responsive feeding follows the child cues while keeping safety and routine consistent.',
    contentSections: [
      {
        heading: 'Real-life situation',
        body: 'A baby turns away from food, reaches for the spoon, or becomes distracted during meals.',
      },
      {
        heading: 'Care response',
        bullets: [
          'Seat the child upright',
          'Offer age-appropriate textures',
          'Watch for hunger and fullness cues',
          'Keep meals calm and unrushed',
        ],
      },
    ],
    questions: [
      {
        question: 'What position is safest for feeding?',
        explanation:
          'An upright position supports swallowing and reduces choking risk.',
        options: ['Lying down', 'Upright and supported', 'Walking around'],
        correctIndex: 1,
      },
      {
        question: 'Responsive feeding means watching child cues.',
        explanation:
          'Caregivers should notice hunger, fullness, interest, and refusal cues.',
        options: ['True', 'False'],
        correctIndex: 0,
      },
      {
        question: 'What is a good mealtime approach?',
        explanation:
          'Calm, low-pressure meals help children build trust around food.',
        options: ['Force every bite', 'Keep meals calm', 'Rush the child'],
        correctIndex: 1,
      },
    ],
  },
  {
    title: 'Sleep routine basics',
    subtitle: 'Build predictable rest with gentle transitions',
    description:
      'Create nap and bedtime routines that help children settle with less stress.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1519689680058-324335c77eba?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.SLEEP_ROUTINES,
    estimatedMinutes: 75,
    coinReward: 10,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 6,
    keyTakeaway:
      'Predictable routines help children know what comes next and settle more easily.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Use the same calming steps daily',
          'Dim lights before sleep',
          'Keep transitions brief and warm',
        ],
      },
    ],
    questions: [
      {
        question: 'What helps children settle for sleep?',
        explanation:
          'Predictable steps reduce uncertainty and support regulation.',
        options: ['A consistent routine', 'New rules every night', 'Loud play'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Child safety at home',
    subtitle: 'Reduce everyday risks in play and care spaces',
    description:
      'Spot common home hazards and build safer supervision habits.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.CHILD_SAFETY,
    estimatedMinutes: 60,
    coinReward: 10,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 7,
    keyTakeaway:
      'Safe spaces are prepared before play starts, not only after risk appears.',
    contentSections: [
      {
        heading: 'Safety scan',
        bullets: [
          'Move small objects out of reach',
          'Secure cleaning products',
          'Check furniture edges and cords',
        ],
      },
    ],
    questions: [
      {
        question: 'When should a caregiver scan the room?',
        explanation:
          'A quick scan before play prevents many common accidents.',
        options: ['Before play begins', 'Only after an accident', 'Never'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'First aid readiness',
    subtitle: 'Know what to do in common urgent moments',
    description:
      'Prepare for minor cuts, bumps, choking risks, and when to call for help.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1584515933487-779824d29309?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.FIRST_AID,
    estimatedMinutes: 95,
    coinReward: 15,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 8,
    keyTakeaway:
      'Prepared caregivers respond faster and escalate when symptoms are serious.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Keep emergency contacts visible',
          'Know allergy and medication notes',
          'Report injuries clearly to parents',
        ],
      },
    ],
    questions: [
      {
        question: 'What should be easy to find in an emergency?',
        explanation:
          'Emergency contacts and child health notes support fast decisions.',
        options: ['Emergency contacts', 'Toy catalogues', 'Old receipts'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Play and learning moments',
    subtitle: 'Turn everyday play into development support',
    description:
      'Use play to support language, movement, creativity, and connection.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.PLAY_LEARNING,
    estimatedMinutes: 80,
    coinReward: 10,
    suggestedMinAgeYears: 1,
    suggestedMaxAgeYears: 6,
    keyTakeaway:
      'Simple shared play can build attention, communication, and confidence.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Follow the child interest',
          'Name actions and objects',
          'Celebrate effort, not only outcomes',
        ],
      },
    ],
    questions: [
      {
        question: 'What is a strong play strategy?',
        explanation:
          'Following the child interest increases engagement and learning.',
        options: ['Follow child interest', 'Control every move', 'Avoid talking'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Communication with parents',
    subtitle: 'Share care updates clearly and respectfully',
    description:
      'Keep parents informed with useful updates about routines, meals, mood, and concerns.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.COMMUNICATION,
    estimatedMinutes: 55,
    coinReward: 10,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 8,
    keyTakeaway:
      'Useful updates are specific, calm, timely, and focused on the child.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Share facts before opinions',
          'Include meals, sleep, mood, and activities',
          'Flag concerns early',
        ],
      },
    ],
    questions: [
      {
        question: 'What makes a parent update useful?',
        explanation:
          'Specific facts help parents understand the child day clearly.',
        options: ['Specific and timely details', 'Vague comments', 'No context'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Health and hygiene habits',
    subtitle: 'Support clean routines without stress',
    description:
      'Build handwashing, diapering, toileting, and illness-prevention routines.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1584744982491-665216d95f8b?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.HEALTH_HYGIENE,
    estimatedMinutes: 65,
    coinReward: 10,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 7,
    keyTakeaway:
      'Repeated hygiene routines become easier when they are predictable and calm.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Wash hands before meals',
          'Use clean diapering steps',
          'Model hygiene with simple language',
        ],
      },
    ],
    questions: [
      {
        question: 'When should handwashing happen?',
        explanation:
          'Handwashing before meals reduces germ spread and supports healthy routines.',
        options: ['Before meals', 'Only at bedtime', 'Never'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Morning transition support',
    subtitle: 'Start the day with smoother care handoffs',
    description:
      'Help children separate, settle, and begin routines with confidence.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.SLEEP_ROUTINES,
    estimatedMinutes: 45,
    coinReward: 8,
    suggestedMinAgeYears: 1,
    suggestedMaxAgeYears: 7,
    keyTakeaway:
      'A warm, predictable handoff can reduce stress for both child and caregiver.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Greet the child by name',
          'Use one familiar transition object or routine',
          'Keep goodbye moments brief and warm',
        ],
      },
    ],
    questions: [
      {
        question: 'What supports a smoother morning handoff?',
        explanation:
          'Predictability and warmth help children settle into the day.',
        options: ['A familiar routine', 'Long uncertainty', 'Ignoring feelings'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Managing picky eating',
    subtitle: 'Support food exploration without pressure',
    description:
      'Respond to food refusal with patience, structure, and repeated exposure.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.NUTRITION_FEEDING,
    estimatedMinutes: 70,
    coinReward: 10,
    suggestedMinAgeYears: 1,
    suggestedMaxAgeYears: 6,
    keyTakeaway:
      'Repeated low-pressure exposure works better than forcing bites.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Offer tiny tastes without pressure',
          'Pair familiar foods with new foods',
          'Avoid labeling the child as picky',
        ],
      },
    ],
    questions: [
      {
        question: 'What helps food exploration?',
        explanation:
          'Low-pressure exposure builds familiarity and trust over time.',
        options: ['Repeated low-pressure exposure', 'Force feeding', 'Bribery only'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Outdoor safety basics',
    subtitle: 'Keep playground and walk time safe',
    description:
      'Prepare for outdoor play with supervision, sun care, hydration, and boundaries.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1596464716127-f2a82984de30?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.CHILD_SAFETY,
    estimatedMinutes: 50,
    coinReward: 8,
    suggestedMinAgeYears: 1,
    suggestedMaxAgeYears: 8,
    keyTakeaway:
      'Outdoor safety starts with clear boundaries and active supervision.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Set a visible play boundary',
          'Check equipment before use',
          'Keep water available',
        ],
      },
    ],
    questions: [
      {
        question: 'What is active supervision?',
        explanation:
          'Active supervision means watching and staying close enough to respond.',
        options: ['Watching and staying close', 'Looking away often', 'Leaving the area'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Language through daily care',
    subtitle: 'Build words during ordinary routines',
    description:
      'Use meals, dressing, play, and cleanup as natural language moments.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1484820540004-14229fe36ca4?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.COMMUNICATION,
    estimatedMinutes: 60,
    coinReward: 10,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 5,
    keyTakeaway:
      'Narrating care routines helps children connect words with real experiences.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Name what the child sees',
          'Pause so the child can respond',
          'Repeat key words naturally',
        ],
      },
    ],
    questions: [
      {
        question: 'What builds language during care?',
        explanation:
          'Simple narration connects words to actions and objects.',
        options: ['Naming actions and objects', 'Silent routines', 'Rushing'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Toileting readiness',
    subtitle: 'Notice signs and support without pressure',
    description:
      'Understand toileting readiness and create calm, respectful routines.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1595454038955-4d80d06358b2?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.HEALTH_HYGIENE,
    estimatedMinutes: 65,
    coinReward: 10,
    suggestedMinAgeYears: 2,
    suggestedMaxAgeYears: 5,
    keyTakeaway:
      'Toileting progress is easier when caregivers follow readiness, not pressure.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Watch for readiness signs',
          'Use neutral, encouraging language',
          'Keep clothing simple',
        ],
      },
    ],
    questions: [
      {
        question: 'What should guide toileting support?',
        explanation:
          'Readiness signs help caregivers support progress without stress.',
        options: ['Readiness signs', 'Pressure', 'Comparison with others'],
        correctIndex: 0,
      },
    ],
  },
  {
    title: 'Caregiver professionalism',
    subtitle: 'Build trust through consistency and respect',
    description:
      'Strengthen the care relationship with reliability, boundaries, and thoughtful communication.',
    coverImageUrl:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1200&auto=format&fit=crop',
    category: CareModuleCategory.OTHER,
    estimatedMinutes: 50,
    coinReward: 8,
    suggestedMinAgeYears: 0,
    suggestedMaxAgeYears: 8,
    keyTakeaway:
      'Professional care is warm, reliable, respectful, and well-communicated.',
    contentSections: [
      {
        heading: 'Care response',
        bullets: [
          'Arrive prepared',
          'Respect family preferences',
          'Communicate concerns early',
        ],
      },
    ],
    questions: [
      {
        question: 'What builds trust with families?',
        explanation:
          'Reliability and respectful communication help families feel secure.',
        options: ['Reliability and respect', 'Frequent surprises', 'No updates'],
        correctIndex: 0,
      },
    ],
  },
];

export async function seedCareModules(prisma: PrismaClient) {
  console.log('Seeding care modules and sample care assignments...');

  const createdModules: Array<{ id: string; title: string }> = [];

  for (const moduleSeed of careModules) {
    const existingModule = await prisma.careModule.findFirst({
      where: { title: moduleSeed.title },
      select: {
        id: true,
        title: true,
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const moduleData = {
      subtitle: moduleSeed.subtitle,
      description: moduleSeed.description,
      coverImageUrl: moduleSeed.coverImageUrl,
      category: moduleSeed.category,
      estimatedMinutes: moduleSeed.estimatedMinutes,
      coinReward: moduleSeed.coinReward,
      contentTitle: moduleSeed.title,
      contentSections: moduleSeed.contentSections,
      keyTakeaway: moduleSeed.keyTakeaway,
      isPublished: true,
      adminStatus: CareModuleAdminStatus.PUBLISHED,
      suggestedMinAgeYears: moduleSeed.suggestedMinAgeYears,
      suggestedMaxAgeYears: moduleSeed.suggestedMaxAgeYears,
    };

    const module = existingModule
      ? await prisma.careModule.update({
          where: { id: existingModule.id },
          data: moduleData,
          select: { id: true, title: true },
        })
      : await prisma.careModule.create({
          data: {
            title: moduleSeed.title,
            ...moduleData,
            questions: {
              create: questionCreates(moduleSeed),
            },
          },
          select: { id: true, title: true },
        });

    if (existingModule && existingModule._count.questions === 0) {
      await prisma.careQuizQuestion.createMany({
        data: moduleSeed.questions.map((question, questionIndex) => ({
          moduleId: module.id,
          question: question.question,
          type:
            question.options.length === 2
              ? CareQuestionType.TRUE_FALSE
              : CareQuestionType.SINGLE_CHOICE,
          explanation: question.explanation,
          sortOrder: questionIndex + 1,
        })),
      });

      const questions = await prisma.careQuizQuestion.findMany({
        where: { moduleId: module.id },
        select: { id: true, sortOrder: true },
      });

      await prisma.careQuizOption.createMany({
        data: questions.flatMap((createdQuestion) => {
          const question = moduleSeed.questions[createdQuestion.sortOrder - 1];

          return question.options.map((label, optionIndex) => ({
            questionId: createdQuestion.id,
            label,
            isCorrect: optionIndex === question.correctIndex,
            sortOrder: optionIndex + 1,
          }));
        }),
      });
    }

    createdModules.push(module);
  }

  await seedSampleCareAssignments(prisma, createdModules);

  console.log(`Care modules seeded: ${createdModules.length}`);
}

function questionCreates(moduleSeed: CareModuleSeed) {
  return moduleSeed.questions.map((question, questionIndex) => ({
    question: question.question,
    type:
      question.options.length === 2
        ? CareQuestionType.TRUE_FALSE
        : CareQuestionType.SINGLE_CHOICE,
    explanation: question.explanation,
    sortOrder: questionIndex + 1,
    options: {
      create: question.options.map((label, optionIndex) => ({
        label,
        isCorrect: optionIndex === question.correctIndex,
        sortOrder: optionIndex + 1,
      })),
    },
  }));
}

async function seedSampleCareAssignments(
  prisma: PrismaClient,
  modules: Array<{ id: string; title: string }>,
) {
  const [parent, nanny, eve, ava] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'p@e.com' }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: 'n@e.com' }, select: { id: true } }),
    prisma.child.findFirst({
      where: { name: 'Eve' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.child.findFirst({
      where: { name: 'Ava' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!parent || !nanny || !eve) {
    console.log('Skipped care assignments: parent, nanny, or Eve child missing.');
    return;
  }

  await prisma.nannyChildLink.upsert({
    where: {
      nannyUserId_childId: {
        nannyUserId: nanny.id,
        childId: eve.id,
      },
    },
    update: {
      canViewStory: true,
      canUpdateProof: true,
    },
    create: {
      nannyUserId: nanny.id,
      childId: eve.id,
      canViewStory: true,
      canUpdateProof: true,
    },
  });

  await Promise.all(
    modules.map((module, index) =>
      prisma.careModuleAssignment.upsert({
        where: {
          moduleId_childId_nannyUserId: {
            moduleId: module.id,
            childId: eve.id,
            nannyUserId: nanny.id,
          },
        },
        update: assignmentData(parent.id, index),
        create: {
          moduleId: module.id,
          childId: eve.id,
          nannyUserId: nanny.id,
          ...assignmentData(parent.id, index),
        },
      }),
    ),
  );

  await Promise.all(
    modules.slice(0, 3).flatMap((module) => [
      prisma.careModuleSave.upsert({
        where: {
          moduleId_userId_childId: {
            moduleId: module.id,
            userId: parent.id,
            childId: eve.id,
          },
        },
        update: {},
        create: {
          moduleId: module.id,
          userId: parent.id,
          childId: eve.id,
        },
      }),
      prisma.careModuleSave.upsert({
        where: {
          moduleId_userId_childId: {
            moduleId: module.id,
            userId: nanny.id,
            childId: eve.id,
          },
        },
        update: {},
        create: {
          moduleId: module.id,
          userId: nanny.id,
          childId: eve.id,
        },
      }),
    ]),
  );

  await seedCareInsightActivities(prisma, {
    childId: eve.id,
    childName: 'Eve',
    parentUserId: parent.id,
    nannyUserId: nanny.id,
  });

  if (ava) {
    await seedCareInsightActivities(prisma, {
      childId: ava.id,
      childName: 'Ava',
      parentUserId: parent.id,
      nannyUserId: nanny.id,
    });
  }

  console.log(`Care assignments seeded for Eve: ${modules.length}`);
}

async function seedCareInsightActivities(
  prisma: PrismaClient,
  input: {
    childId: string;
    childName: string;
    parentUserId: string;
    nannyUserId: string;
  },
) {
  const plan = await prisma.dayPlan.upsert({
    where: {
      childId_date: {
        childId: input.childId,
        date: new Date('2026-08-08T00:00:00.000Z'),
      },
    },
    update: {
      mode: DayPlanBuildMode.MANUAL,
      status: DayPlanStatus.READY,
      title: `${input.childName} care insights seed day`,
      summary: 'Seeded care activities and meals for insight widgets.',
      createdByUserId: input.parentUserId,
    },
    create: {
      childId: input.childId,
      date: new Date('2026-08-08T00:00:00.000Z'),
      mode: DayPlanBuildMode.MANUAL,
      status: DayPlanStatus.READY,
      title: `${input.childName} care insights seed day`,
      summary: 'Seeded care activities and meals for insight widgets.',
      createdByUserId: input.parentUserId,
    },
  });

  const activities = [
    {
      category: 'ACTIVITY_CREATIVE_PLAY',
      title: 'Drawing & Coloring',
      description: `${input.childName} stayed focused and proudly described the picture.`,
      imageUrl:
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop',
      startTime: new Date('2026-08-08T09:30:00.000Z'),
      endTime: new Date('2026-08-08T10:00:00.000Z'),
      note: `${input.childName} loved choosing colors and asked to show the drawing later.`,
      enjoyment: TaskEnjoymentLevel.LOVE_IT,
      childMood: ChildMood.HAPPY,
      completionRate: TaskCompletionRate.FULL_PLATE,
      sortOrder: 1,
    },
    {
      category: 'ACTIVITY_STORY_TIME',
      title: 'Story Time',
      description: `${input.childName} listened closely and repeated new words from the book.`,
      imageUrl:
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800&auto=format&fit=crop',
      startTime: new Date('2026-08-08T10:30:00.000Z'),
      endTime: new Date('2026-08-08T11:00:00.000Z'),
      note: 'She enjoyed pointing to characters and predicting what came next.',
      enjoyment: TaskEnjoymentLevel.ENJOY_IT,
      childMood: ChildMood.EXCITED,
      completionRate: TaskCompletionRate.FULL_PLATE,
      sortOrder: 2,
    },
    {
      category: 'RECIPE_BREAKFAST',
      title: 'Blueberry Oat Porridge',
      description: 'Warm oats with blueberries and banana slices.',
      imageUrl:
        'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=800&auto=format&fit=crop',
      startTime: new Date('2026-08-08T07:30:00.000Z'),
      endTime: new Date('2026-08-08T08:00:00.000Z'),
      note: 'Finished the bowl and asked for extra blueberries.',
      enjoyment: TaskEnjoymentLevel.LOVE_IT,
      childMood: ChildMood.HAPPY,
      completionRate: TaskCompletionRate.FULL_PLATE,
      sortOrder: 3,
    },
    {
      category: 'MEAL_SNACK',
      title: 'Yogurt Banana Bites',
      description: 'Small banana slices with plain yogurt.',
      imageUrl:
        'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop',
      startTime: new Date('2026-08-08T15:30:00.000Z'),
      endTime: new Date('2026-08-08T15:45:00.000Z'),
      note: 'Ate happily after nap and drank water.',
      enjoyment: TaskEnjoymentLevel.ENJOY_IT,
      childMood: ChildMood.HAPPY,
      completionRate: TaskCompletionRate.FULL_PLATE,
      sortOrder: 4,
    },
  ];

  for (const seed of activities) {
    const existing = await prisma.dayActivity.findFirst({
      where: { dayPlanId: plan.id, title: seed.title },
      select: { id: true },
    });

    const activity = existing
      ? await prisma.dayActivity.update({
          where: { id: existing.id },
          data: {
            category: seed.category,
            description: seed.description,
            imageUrl: seed.imageUrl,
            startTime: seed.startTime,
            endTime: seed.endTime,
            status: ActivityStatus.COMPLETED,
            sortOrder: seed.sortOrder,
          },
          select: { id: true },
        })
      : await prisma.dayActivity.create({
          data: {
            dayPlanId: plan.id,
            category: seed.category,
            title: seed.title,
            description: seed.description,
            imageUrl: seed.imageUrl,
            startTime: seed.startTime,
            endTime: seed.endTime,
            status: ActivityStatus.COMPLETED,
            sortOrder: seed.sortOrder,
          },
          select: { id: true },
        });

    await prisma.dayActivityFeedback.upsert({
      where: { dayActivityId: activity.id },
      update: {
        submittedByUserId: input.nannyUserId,
        enjoyment: seed.enjoyment,
        childMood: seed.childMood,
        completionRate: seed.completionRate,
        note: seed.note,
        submittedAt: new Date('2026-08-08T16:00:00.000Z'),
      },
      create: {
        dayActivityId: activity.id,
        submittedByUserId: input.nannyUserId,
        enjoyment: seed.enjoyment,
        childMood: seed.childMood,
        completionRate: seed.completionRate,
        note: seed.note,
        submittedAt: new Date('2026-08-08T16:00:00.000Z'),
      },
    });

    const existingMedia = await prisma.mediaAsset.findFirst({
      where: {
        ownerUserId: input.nannyUserId,
        url: seed.imageUrl,
      },
      select: { id: true },
    });

    const mediaAsset =
      existingMedia ??
      (await prisma.mediaAsset.create({
        data: {
          ownerUserId: input.nannyUserId,
          type: MediaType.IMAGE,
          url: seed.imageUrl,
          storageKey: seed.imageUrl,
          mimeType: 'image/jpeg',
        },
        select: { id: true },
      }));

    const existingProof = await prisma.dayActivityProof.findFirst({
      where: {
        dayActivityId: activity.id,
        mediaAssetId: mediaAsset.id,
      },
      select: { id: true },
    });

    if (existingProof) {
      await prisma.dayActivityProof.update({
        where: { id: existingProof.id },
        data: {
          uploadedByUserId: input.nannyUserId,
          caption: seed.note,
        },
      });
    } else {
      await prisma.dayActivityProof.create({
        data: {
          dayActivityId: activity.id,
          mediaAssetId: mediaAsset.id,
          uploadedByUserId: input.nannyUserId,
          caption: seed.note,
        },
      });
    }

    await prisma.dayActivity.update({
      where: { id: activity.id },
      data: { proofMediaId: mediaAsset.id },
    });
  }

  console.log(
    `Care insight activities seeded for ${input.childName}: ${activities.length}`,
  );
}

function assignmentData(assignedByUserId: string, index: number) {
  if (index >= 10) {
    return {
      assignedByUserId,
      status: CareModuleAssignmentStatus.COMPLETED,
      startedAt: new Date('2026-08-08T02:30:00.000Z'),
      completedAt: new Date('2026-08-08T03:00:00.000Z'),
      score: 100,
      totalQuestions: 1,
      correctAnswers: 1,
      pointsEarned: 2,
      pointsAwardedAt: new Date('2026-08-08T03:00:00.000Z'),
    };
  }

  return {
    assignedByUserId,
    status: CareModuleAssignmentStatus.IN_PROGRESS,
    startedAt: new Date('2026-08-08T02:30:00.000Z'),
    completedAt: index < 2 ? new Date('2026-08-08T03:00:00.000Z') : null,
    score: index < 2 ? 60 : null,
    totalQuestions: index < 2 ? 5 : null,
    correctAnswers: index < 2 ? 3 : null,
    pointsEarned: 0,
    pointsAwardedAt: null,
  };
}
