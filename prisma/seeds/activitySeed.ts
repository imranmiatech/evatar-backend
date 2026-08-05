import { PrismaClient, ActivityType, EnergyLevel, ActivityLocation } from '@prisma/client';

export async function seedActivities(prisma: PrismaClient) {
    const activitiesData = [
        {
            title: 'Color Hunt Discovery',
            imageUrl: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&q=80',
            activityType: ActivityType.OUTDOOR_PLAY,
            minAgeMonths: 36,
            maxAgeMonths: 96,
            durationMin: 10,
            durationMax: 20,
            energyLevel: EnergyLevel.MEDIUM_HIGH,
            location: [ActivityLocation.INDOOR, ActivityLocation.OUTDOOR, ActivityLocation.GROUP],
            connectionMoment: 'Children co-create a shared imaginary world where ideas are visible, named, and valued by the group.',
            whyThisActivity: 'Encourages children to create entirely new "things that don\'t exist" using their bodies, then collaboratively name and define them. Builds imagination, group creativity, and early abstract thinking.',
            caregiverPrompts: [
                'What does your shape become?',
                'What should we call it?',
                'What does it do in our world?'
            ],
            benefits: [
                { title: 'Imaginative', description: 'Symbol creation, abstract thinking', iconUrl: 'brain' },
                { title: 'Social', description: 'Collaboration, shared creation', iconUrl: 'users' },
                { title: 'Cognitive', description: 'Divergent thinking, categorization', iconUrl: 'bulb' },
                { title: 'Emotional', description: 'Confidence, expression', iconUrl: 'heart' },
            ],
            steps: [
                { stepNumber: 1, description: 'Gather children together.' },
                { stepNumber: 2, description: 'Explain: "We are going to create shapes that don\'t exist in the world."' },
                { stepNumber: 3, description: 'Each child uses their body to form a unique shape (standing, lying, bending, contorting movements).' },
                { stepNumber: 4, description: 'Other children observe and interpret what they see.' },
                { stepNumber: 5, description: 'Encourage discussion about shapes, sizes, and textures.' },
                { stepNumber: 6, description: 'Creator explains what their shape "does" or "is used for".' },
                { stepNumber: 7, description: 'Rotate turns so each child becomes a creator.' },
                { stepNumber: 8, description: 'Build a collection of invented shapes as the session continues.' },
            ],
            progressions: [
                { level: 1, description: 'Focus on holding a single interesting pose for 10 seconds.' },
                { level: 2, description: 'Connect with one partner using hands or feet only.' },
                { level: 3, description: 'All participants connect into one single, massive organism.' },
                { level: 4, description: 'The \'Impossible Shape\' begins to move across the room as one unit.' },
            ],
        },
        {
            title: 'Sensory Bin Exploration',
            imageUrl: 'https://images.unsplash.com/photo-1544640808-32cb4fbadfac?w=500&q=80',
            activityType: ActivityType.LEARNING_DEVELOPMENT,
            minAgeMonths: 12,
            maxAgeMonths: 36,
            durationMin: 15,
            durationMax: 30,
            energyLevel: EnergyLevel.LOW,
            location: [ActivityLocation.INDOOR],
            connectionMoment: 'Watching your child discover new textures and celebrating their small discoveries together.',
            whyThisActivity: 'Develops fine motor skills and sensory processing. Provides a calming, focused environment for exploration.',
            caregiverPrompts: [
                'How does that feel in your hands?',
                'Can you find the red ball hidden in the rice?',
                'Let\'s pour it from one cup to another!'
            ],
            benefits: [
                { title: 'Physical', description: 'Fine motor skills, hand-eye coordination', iconUrl: 'hand' },
                { title: 'Cognitive', description: 'Cause and effect, spatial awareness', iconUrl: 'brain' },
            ],
            steps: [
                { stepNumber: 1, description: 'Fill a large bin with a base material (rice, dry beans, or kinetic sand).' },
                { stepNumber: 2, description: 'Hide small, safe toys or objects within the base material.' },
                { stepNumber: 3, description: 'Provide scoops, cups, and tongs.' },
                { stepNumber: 4, description: 'Allow the child to freely explore, dig, and pour.' },
            ],
            progressions: [
                { level: 1, description: 'Using hands only to feel the texture.' },
                { level: 2, description: 'Using a cup to scoop and pour.' },
                { level: 3, description: 'Using tongs to pick up specific hidden objects.' },
            ],
        },
        {
            title: 'Living Room Obstacle Course',
            imageUrl: 'https://images.unsplash.com/photo-1519340333755-56e9c1d04079?w=500&q=80',
            activityType: ActivityType.OUTDOOR_PLAY,
            minAgeMonths: 24,
            maxAgeMonths: 72,
            durationMin: 15,
            durationMax: 45,
            energyLevel: EnergyLevel.HIGH,
            location: [ActivityLocation.INDOOR],
            connectionMoment: 'Cheering your child on as they conquer a physical challenge.',
            whyThisActivity: 'Burns off excess energy, improves gross motor skills, balance, and following multi-step instructions.',
            caregiverPrompts: [
                'Can you jump over the blue pillow?',
                'Crawl like a bear under the table!',
                'Balance on the tape line without falling off.'
            ],
            benefits: [
                { title: 'Physical', description: 'Gross motor skills, balance, agility', iconUrl: 'activity' },
                { title: 'Cognitive', description: 'Following directions, memory', iconUrl: 'brain' },
            ],
            steps: [
                { stepNumber: 1, description: 'Clear a safe space in the living room.' },
                { stepNumber: 2, description: 'Set up pillows for jumping over.' },
                { stepNumber: 3, description: 'Create a tunnel using chairs and a blanket.' },
                { stepNumber: 4, description: 'Put a line of painter\'s tape on the floor for a balance beam.' },
                { stepNumber: 5, description: 'Demonstrate the course to the child, then let them try.' },
            ],
            progressions: [
                { level: 1, description: 'Complete one obstacle at a time with help.' },
                { level: 2, description: 'Complete the full course independently.' },
                { level: 3, description: 'Time the course and try to beat the record safely.' },
            ],
        },
        {
            title: 'Shadow Puppet Theater',
            imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=80',
            activityType: ActivityType.STORY_TIME,
            minAgeMonths: 36,
            maxAgeMonths: 84,
            durationMin: 15,
            durationMax: 30,
            energyLevel: EnergyLevel.LOW,
            location: [ActivityLocation.INDOOR],
            connectionMoment: 'Laughing together at the silly stories you invent in the dark.',
            whyThisActivity: 'Fosters imagination, storytelling skills, and helps children who might be afraid of the dark feel more comfortable.',
            caregiverPrompts: [
                'What sound does this shadow animal make?',
                'Where is the bird flying to?',
                'Can you make a monster shadow?'
            ],
            benefits: [
                { title: 'Language', description: 'Storytelling, vocabulary expansion', iconUrl: 'mic' },
                { title: 'Imaginative', description: 'Creative thinking, role-play', iconUrl: 'star' },
            ],
            steps: [
                { stepNumber: 1, description: 'Darken the room and turn on a single bright flashlight or lamp pointing at a blank wall.' },
                { stepNumber: 2, description: 'Show the child how to place their hands between the light and the wall to cast shadows.' },
                { stepNumber: 3, description: 'Teach basic shapes like a barking dog or a flying bird.' },
                { stepNumber: 4, description: 'Create a short story together using the shadow characters.' },
            ],
            progressions: [
                { level: 1, description: 'Making simple hand shapes.' },
                { level: 2, description: 'Adding movement and sounds to the shadows.' },
                { level: 3, description: 'Cutting out paper shapes on sticks for more complex stories.' },
            ],
        },
        {
            title: 'Nature Texture Collage',
            imageUrl: 'https://images.unsplash.com/photo-1464692805480-a69dfaaf715d?w=500&q=80',
            activityType: ActivityType.ART,
            minAgeMonths: 24,
            maxAgeMonths: 72,
            durationMin: 20,
            durationMax: 40,
            energyLevel: EnergyLevel.MEDIUM,
            location: [ActivityLocation.OUTDOOR, ActivityLocation.INDOOR],
            connectionMoment: 'Exploring the outdoors hand-in-hand and discussing the beauty of nature.',
            whyThisActivity: 'Combines outdoor physical activity with tactile exploration and creative art expression.',
            caregiverPrompts: [
                'Does this leaf feel smooth or bumpy?',
                'Where do you think we should glue this twig?',
                'What color is this flower petal?'
            ],
            benefits: [
                { title: 'Sensory', description: 'Tactile discrimination', iconUrl: 'eye' },
                { title: 'Creative', description: 'Artistic expression, composition', iconUrl: 'pen' },
            ],
            steps: [
                { stepNumber: 1, description: 'Go on a short walk with a small bag.' },
                { stepNumber: 2, description: 'Collect interesting items: fallen leaves, twigs, smooth stones, and petals.' },
                { stepNumber: 3, description: 'Return home and provide a large piece of sturdy paper and kid-safe glue.' },
                { stepNumber: 4, description: 'Help the child arrange and glue their treasures onto the paper.' },
            ],
            progressions: [
                { level: 1, description: 'Simply exploring and holding the items.' },
                { level: 2, description: 'Gluing items randomly on the page.' },
                { level: 3, description: 'Arranging items to create a specific picture or pattern.' },
            ],
        },
        {
            title: 'Kitchen Band',
            imageUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=500&q=80',
            activityType: ActivityType.MUSIC,
            minAgeMonths: 12,
            maxAgeMonths: 48,
            durationMin: 10,
            durationMax: 20,
            energyLevel: EnergyLevel.HIGH,
            location: [ActivityLocation.INDOOR],
            connectionMoment: 'Making joyful noise and dancing together in the heart of the home.',
            whyThisActivity: 'Develops rhythm, auditory discrimination, and provides a healthy outlet for loud, energetic play.',
            caregiverPrompts: [
                'Can you tap the pot softly?',
                'Let\'s march while we play our drums!',
                'What happens if we hit the metal bowl instead of the plastic one?'
            ],
            benefits: [
                { title: 'Auditory', description: 'Rhythm, sound discrimination', iconUrl: 'music' },
                { title: 'Physical', description: 'Arm strength, coordination', iconUrl: 'activity' },
            ],
            steps: [
                { stepNumber: 1, description: 'Gather safe kitchen items: upside-down pots, plastic bowls, and wooden spoons.' },
                { stepNumber: 2, description: 'Demonstrate how to tap the items to make different sounds.' },
                { stepNumber: 3, description: 'Put on some upbeat music and play along.' },
                { stepNumber: 4, description: 'Try playing fast, then playing very slow.' },
            ],
            progressions: [
                { level: 1, description: 'Banging randomly on pots.' },
                { level: 2, description: 'Copying a simple rhythm pattern (tap, tap, pause).' },
                { level: 3, description: 'Marching and playing at the same time.' },
            ],
        },
        {
            title: 'Water Transfer Station',
            imageUrl: 'https://images.unsplash.com/photo-1536640712-4d4c36ef0e42?w=500&q=80',
            activityType: ActivityType.LEARNING_DEVELOPMENT,
            minAgeMonths: 18,
            maxAgeMonths: 48,
            durationMin: 15,
            durationMax: 30,
            energyLevel: EnergyLevel.LOW,
            location: [ActivityLocation.INDOOR, ActivityLocation.OUTDOOR],
            connectionMoment: 'Observing the intense focus on your child\'s face as they master a new practical life skill.',
            whyThisActivity: 'Excellent for concentration, developing the pincer grasp (pre-writing skill), and learning volume/capacity concepts.',
            caregiverPrompts: [
                'Squeeze the sponge hard to get all the water out!',
                'Is this bowl full or empty now?',
                'Let\'s see if we can move the water without spilling.'
            ],
            benefits: [
                { title: 'Physical', description: 'Hand strength, pincer grasp', iconUrl: 'hand' },
                { title: 'Cognitive', description: 'Concentration, volume concepts', iconUrl: 'brain' },
            ],
            steps: [
                { stepNumber: 1, description: 'Set up two identical bowls on a towel, one filled with water, one empty.' },
                { stepNumber: 2, description: 'Provide a clean kitchen sponge.' },
                { stepNumber: 3, description: 'Show the child how to dip the sponge in the water, move it over the empty bowl, and squeeze.' },
                { stepNumber: 4, description: 'Encourage them to transfer all the water from one bowl to the other.' },
            ],
            progressions: [
                { level: 1, description: 'Using a large sponge and two large bowls.' },
                { level: 2, description: 'Using a small cup or ladle instead of a sponge.' },
                { level: 3, description: 'Using an eyedropper or small syringe to transfer water to a narrow bottle.' },
            ],
        },
        {
            title: 'DIY Puzzle Making',
            imageUrl: 'https://images.unsplash.com/photo-1618842676088-c4d48a6a7c9d?w=500&q=80',
            activityType: ActivityType.CREATIVE_PLAY,
            minAgeMonths: 36,
            maxAgeMonths: 84,
            durationMin: 20,
            durationMax: 45,
            energyLevel: EnergyLevel.LOW,
            location: [ActivityLocation.INDOOR],
            connectionMoment: 'Collaborating on an art project and then solving the puzzle together.',
            whyThisActivity: 'Blends creativity with logic. Helps with spatial reasoning, problem-solving, and patience.',
            caregiverPrompts: [
                'Where does this corner piece go?',
                'Does this blue line match up with that blue line?',
                'What picture should we draw before we cut it up?'
            ],
            benefits: [
                { title: 'Cognitive', description: 'Spatial reasoning, problem solving', iconUrl: 'puzzle' },
                { title: 'Emotional', description: 'Patience, task completion', iconUrl: 'smile' },
            ],
            steps: [
                { stepNumber: 1, description: 'Take a piece of cardboard or thick paper.' },
                { stepNumber: 2, description: 'Have the child draw a large, colorful picture on the paper.' },
                { stepNumber: 3, description: 'An adult uses scissors to cut the picture into several jigsaw-like pieces.' },
                { stepNumber: 4, description: 'Mix up the pieces on the table.' },
                { stepNumber: 5, description: 'Have the child put their own drawing back together.' },
            ],
            progressions: [
                { level: 1, description: 'Cutting the picture into 2-4 simple straight pieces.' },
                { level: 2, description: 'Cutting into 6-8 pieces with some jagged edges.' },
                { level: 3, description: 'Creating a complex 12+ piece puzzle for advanced problem solving.' },
            ],
        }
    ];

    for (const activity of activitiesData) {
        await prisma.activity.create({
            data: {
                title: activity.title,
                imageUrl: activity.imageUrl,
                activityType: activity.activityType,
                minAgeMonths: activity.minAgeMonths,
                maxAgeMonths: activity.maxAgeMonths,
                durationMin: activity.durationMin,
                durationMax: activity.durationMax,
                energyLevel: activity.energyLevel,
                location: activity.location,
                connectionMoment: activity.connectionMoment,
                whyThisActivity: activity.whyThisActivity,
                caregiverPrompts: activity.caregiverPrompts,
                isActive: true,
                benefits: {
                    create: activity.benefits,
                },
                steps: {
                    create: activity.steps,
                },
                progressions: {
                    create: activity.progressions,
                },
            },
        });
    }

    console.log(`Seeded ${activitiesData.length} activities.`);
}
