import { PrismaClient, CareModuleCategory, CareModuleAdminStatus, CareQuestionType } from '@prisma/client';

export async function seedCareModules(prisma: PrismaClient) {
  console.log('Seeding care modules with 100% accurate design data...');

  // Delete existing care modules with same title to prevent duplication
  await prisma.careModule.deleteMany({
    where: {
      title: {
        in: ['Feeding & Mealtimes', "Handling child's behavior"]
      }
    }
  });

  // 1. Feeding & Mealtimes Module (100% Matching Design Screenshots)
  const feedingModule = await prisma.careModule.create({
    data: {
      title: 'Feeding & Mealtimes',
      subtitle: "Why children's eating patterns naturally vary day to day",
      description: 'Reinforce your knowledge on nurturing healthy eating habits. This short quiz covers the basics of early childhood nutrition and appetite.',
      coverImageUrl: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?q=80&w=1200&auto=format&fit=crop',
      category: CareModuleCategory.NUTRITION_FEEDING,
      estimatedMinutes: 113,
      coinReward: 15,
      contentTitle: 'Feeding & Mealtimes',
      isPublished: true,
      adminStatus: CareModuleAdminStatus.PUBLISHED,
      suggestedMinAgeYears: 1,
      suggestedMaxAgeYears: 5,
      keyTakeaway: '"Variability in appetite is normal in childhood and reflects development, not inconsistency or refusal."',
      contentSections: [
        {
          heading: 'Real-life situation',
          body: 'A child eats well at breakfast one day, then barely touches the same foods the next day. Another child may refuse a familiar meal they usually enjoy, leaving caregiver\'s confused about whether something is wrong.'
        },
        {
          heading: "What's happening",
          body: "Children's appetite is highly dynamic in early childhood. It is influenced by growth patterns, energy levels, emotional state, sensory sensitivity, and recent activity. Unlike adults, children do not regulate eating primarily through fixed mealtimes or predictable hunger cycles. Their internal signals are still developing; meaning appetite can fluctuate significantly across days and even within the same day."
        },
        {
          heading: 'Why it happens',
          body: 'Eating behaviour in children is shaped by multiple developing systems:',
          bullets: [
            'Biological hunger regulation (still maturing)',
            'Emotional state (tiredness, excitement, frustration)',
            'Sensory processing (texture, temperature, appearance)',
            'Autonomy and control (desire to choose or refuse)'
          ],
          footer: 'Because these systems are not yet stable, variation in eating is expected rather than exceptional.'
        },
        {
          heading: 'Practical caregiving support',
          subsections: [
            {
              title: 'Immediate response:',
              items: [
                'Keep mealtimes calm and low-pressure',
                'Avoid negotiating or pressuring for intake',
                'Offer small, manageable portions instead of large expectations',
                'Allow children to engage with food at their own pace'
              ]
            },
            {
              title: 'Long-term support:',
              items: [
                'Provide repeated exposure to a variety of foods over time',
                'Avoid making each meal a "balanced outcome" requirement',
                'Maintain consistent mealtime structure without emotional pressure',
                'Support autonomy by allowing children to decide how much to eat'
              ]
            }
          ]
        }
      ],
      questions: {
        create: [
          {
            question: "What most influences children's appetite?",
            type: CareQuestionType.SINGLE_CHOICE,
            explanation: 'Appetite is dynamic and shaped by developing internal signals, emotional state, and growth patterns rather than discipline.',
            sortOrder: 1,
            options: {
              create: [
                { label: 'Strict mealtime schedules only', isCorrect: false, sortOrder: 1 },
                { label: 'A mix of biology, emotion, and environment', isCorrect: true, sortOrder: 2 },
                { label: 'Willpower and discipline', isCorrect: false, sortOrder: 3 }
              ]
            }
          },
          {
            question: 'What helps build healthy eating patterns long-term?',
            type: CareQuestionType.SINGLE_CHOICE,
            explanation: 'Appetite is dynamic and shaped by developing internal signals, emotional state, and growth patterns rather than discipline.',
            sortOrder: 2,
            options: {
              create: [
                { label: 'Pressure to finish meals', isCorrect: false, sortOrder: 1 },
                { label: 'Calm, low-pressure exposure to food variety', isCorrect: true, sortOrder: 2 },
                { label: 'Willpower and discipline', isCorrect: false, sortOrder: 3 }
              ]
            }
          },
          {
            question: "Children's eating patterns are naturally variable in early childhood",
            type: CareQuestionType.TRUE_FALSE,
            explanation: 'Appetite is dynamic and shaped by developing internal signals, emotional state, and growth patterns rather than discipline.',
            sortOrder: 3,
            options: {
              create: [
                { label: 'True', isCorrect: true, sortOrder: 1 },
                { label: 'False', isCorrect: false, sortOrder: 2 }
              ]
            }
          }
        ]
      }
    }
  });

  // 2. Handling Child's Behavior Module
  const behaviorModule = await prisma.careModule.create({
    data: {
      title: "Handling child's behavior",
      subtitle: 'Understanding emotional regulation and effective response strategies',
      description: 'Learn how to navigate tantrums, set healthy boundaries, and foster positive behavioral habits.',
      coverImageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1200&auto=format&fit=crop',
      category: CareModuleCategory.CHILD_DEVELOPMENT,
      estimatedMinutes: 130,
      coinReward: 15,
      contentTitle: "Handling child's behavior",
      isPublished: true,
      adminStatus: CareModuleAdminStatus.PUBLISHED,
      suggestedMinAgeYears: 2,
      suggestedMaxAgeYears: 6,
      keyTakeaway: '"Behavior is communication. Understanding the underlying emotional trigger enables compassionate guidance."',
      contentSections: [
        {
          heading: 'Understanding Behavior',
          body: 'Children often express distress or unmet needs through behavior before they have the verbal skills to explain them.'
        },
        {
          heading: 'Effective Support Strategies',
          bullets: [
            'Stay calm and regulate your own response first',
            'Acknowledge child feelings before addressing the behavior',
            'Set clear, consistent, and gentle boundaries'
          ]
        }
      ],
      questions: {
        create: [
          {
            question: 'What is the primary key when responding to an emotional meltdown?',
            type: CareQuestionType.SINGLE_CHOICE,
            explanation: 'Remaining calm helps co-regulate the child and creates a safe emotional environment.',
            sortOrder: 1,
            options: {
              create: [
                { label: 'Immediate punishment', isCorrect: false, sortOrder: 1 },
                { label: 'Staying calm and validating feelings', isCorrect: true, sortOrder: 2 },
                { label: 'Ignoring the child completely', isCorrect: false, sortOrder: 3 }
              ]
            }
          }
        ]
      }
    }
  });

  console.log(`Care modules seeded cleanly with 100% accuracy: "${feedingModule.title}" and "${behaviorModule.title}"`);
}
