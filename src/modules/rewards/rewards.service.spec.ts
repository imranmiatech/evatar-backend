import { ActivityStatus, MediaType, RewardLedgerEntryType, RewardLedgerSourceType, UserRole } from '@prisma/client';
import { RewardsService } from './rewards.service';

describe('RewardsService', () => {
  const makeService = () => {
    const prisma = {
      rewardRule: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      rewardAccount: {
        upsert: jest
          .fn()
          .mockResolvedValue({ userId: 'user-1', balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 }),
      },
      child: {
        findMany: jest.fn().mockResolvedValue([{ id: 'child-1' }]),
      },
      childSchedule: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      mediaAsset: {
        create: jest.fn().mockResolvedValue({ id: 'media-1' }),
      },
      dayActivityProof: {
        create: jest.fn().mockResolvedValue({ id: 'proof-1' }),
      },
      dayActivity: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      rewardLedgerEntry: {
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) =>
        callback({
          rewardLedgerEntry: prisma.rewardLedgerEntry,
          rewardAccount: prisma.rewardAccount,
        }),
      ),
    };

    const caregiverService = {
      assertChildPermission: jest.fn().mockResolvedValue(undefined),
    };

    const storageService = {
      uploadFile: jest.fn().mockResolvedValue('https://cdn.example.com/test.jpg'),
    };

    const service = new RewardsService(
      prisma as any,
      caregiverService as any,
      storageService as any,
    );

    return { service, prisma, caregiverService, storageService };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('classifies parent breakfast without media as 20 points', async () => {
    const { service, prisma } = makeService();
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'BREAKFAST' },
      activity: null,
    });

    const result = await (service as any).resolveTaskRewardDecision('parent-1', 'activity-1', {
      title: 'Oat Bowl',
      category: 'RECIPE',
      childId: 'child-1',
      dayPlanDate: '2026-08-22T00:00:00.000Z',
      hasMedia: false,
      completedByRole: UserRole.PARENT,
    });

    expect(result.activityKey).toBe('EF_01_BREAKFAST_LOGGED');
    expect(result.points).toBe(20);
  });

  it('classifies parent lunch with media as 50 points', async () => {
    const { service, prisma } = makeService();
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'LUNCH' },
      activity: null,
    });

    const result = await (service as any).resolveTaskRewardDecision('parent-1', 'activity-1', {
      title: 'Lunch',
      category: 'RECIPE',
      childId: 'child-1',
      dayPlanDate: '2026-08-22T00:00:00.000Z',
      hasMedia: true,
      completedByRole: UserRole.PARENT,
    });

    expect(result.activityKey).toBe('EF_02_LUNCH_LOGGED');
    expect(result.points).toBe(50);
  });

  it('classifies shared parent activity at 75 percent of standard points', async () => {
    const { service, prisma } = makeService();
    prisma.child.findMany.mockResolvedValue([{ id: 'child-1' }, { id: 'child-2' }]);
    prisma.dayActivity.count.mockResolvedValue(1);
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: null,
      activity: { activityType: 'CREATIVE_PLAY' },
    });

    const result = await (service as any).resolveTaskRewardDecision('parent-1', 'activity-1', {
      title: 'Creative Play',
      category: 'ACTIVITY',
      childId: 'child-1',
      dayPlanDate: '2026-08-22T00:00:00.000Z',
      hasMedia: true,
      completedByRole: UserRole.PARENT,
    });

    expect(result.activityKey).toBe('EF_12_SHARED_ACTIVITY');
    expect(result.points).toBe(75);
  });

  it('classifies nanny meal with media as 30 points', async () => {
    const { service, prisma } = makeService();
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'DINNER' },
      activity: null,
    });

    const result = await (service as any).resolveTaskRewardDecision('nanny-1', 'activity-1', {
      title: 'Dinner',
      category: 'RECIPE',
      childId: 'child-1',
      dayPlanDate: '2026-08-22T00:00:00.000Z',
      hasMedia: true,
      completedByRole: UserRole.NANNY,
    });

    expect(result.activityKey).toBe('EN_01_MEAL_LOGGED');
    expect(result.points).toBe(30);
  });

  it('classifies nanny meal without media as zero points', async () => {
    const { service, prisma } = makeService();
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'SNACK' },
      activity: null,
    });

    const result = await (service as any).resolveTaskRewardDecision('nanny-1', 'activity-1', {
      title: 'Snack',
      category: 'RECIPE',
      childId: 'child-1',
      dayPlanDate: '2026-08-22T00:00:00.000Z',
      hasMedia: false,
      completedByRole: UserRole.NANNY,
    });

    expect(result.activityKey).toBe('EN_01_MEAL_LOGGED');
    expect(result.points).toBe(0);
  });

  it('uses parent and nanny care module fixed points', async () => {
    const { service } = makeService();
    const awardActivityRewardSpy = jest
      .spyOn(service, 'awardActivityReward')
      .mockResolvedValue({ awarded: true, account: { balance: 0 }, ledgerEntry: null, points: 0 } as any);

    await service.awardCareModuleCompletion('parent-1', 'assignment-1', 999, {
      completedByRole: UserRole.PARENT,
    });
    await service.awardCareModuleCompletion('nanny-1', 'assignment-2', 999, {
      completedByRole: UserRole.NANNY,
    });

    expect(awardActivityRewardSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ defaultPoints: 150 }),
    );
    expect(awardActivityRewardSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ defaultPoints: 80 }),
    );
  });

  it('upgrades points when media is added within 24 hours', async () => {
    const { service, prisma } = makeService();
    prisma.rewardLedgerEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      userId: 'parent-1',
      entryType: RewardLedgerEntryType.EARN,
      sourceType: RewardLedgerSourceType.DAY_ACTIVITY,
      sourceId: 'activity-1',
      points: 20,
      balanceAfter: 20,
      description: 'Logged meal',
      metadata: { hasMedia: false },
      createdAt: new Date('2026-08-22T00:00:00.000Z'),
    });
    prisma.rewardAccount.update = jest
      .fn()
      .mockResolvedValue({ userId: 'parent-1', balance: 50, lifetimeEarned: 50, lifetimeSpent: 0 });
    prisma.rewardLedgerEntry.create.mockResolvedValue({
      id: 'adj-1',
      points: 30,
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        rewardLedgerEntry: prisma.rewardLedgerEntry,
        rewardAccount: {
          ...prisma.rewardAccount,
          update: prisma.rewardAccount.update,
        },
      }),
    );

    const result = await (service as any).awardUpgradableTaskReward({
      userId: 'parent-1',
      sourceId: 'activity-1',
      points: 50,
      description: 'Logged meal',
      metadata: { hasMedia: true },
      rewardRuleActivityKey: 'EF_01_BREAKFAST_LOGGED',
      weeklyLimit: null,
    });

    expect(result.awarded).toBe(true);
    expect(result.points).toBe(30);
    expect(prisma.rewardLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: RewardLedgerEntryType.ADJUSTMENT,
          points: 30,
        }),
      }),
    );
  });

  it('completes a task with uploaded media without changing response shape', async () => {
    const { service, prisma, caregiverService, storageService } = makeService();
    prisma.dayActivity.findUnique.mockResolvedValue({
      id: 'activity-1',
      title: 'Breakfast',
      category: 'RECIPE',
      description: null,
      proofMediaId: null,
      proofs: [],
      dayPlan: {
        childId: 'child-1',
        date: new Date('2026-08-22T00:00:00.000Z'),
        child: { id: 'child-1', name: 'Ava' },
      },
    });
    prisma.dayActivity.update.mockResolvedValue({ id: 'activity-1', status: ActivityStatus.COMPLETED });
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'BREAKFAST' },
      activity: null,
    });
    prisma.rewardLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.rewardLedgerEntry.create.mockResolvedValue({
      id: 'entry-1',
      points: 50,
    });
    prisma.rewardAccount.upsert.mockResolvedValue({
      userId: 'parent-1',
      balance: 50,
      lifetimeEarned: 50,
      lifetimeSpent: 0,
    });

    const result = await service.completeTaskForReward(
      { userId: 'parent-1', role: UserRole.PARENT } as any,
      'activity-1',
      {
        fieldname: 'image',
        originalname: 'breakfast.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('abc'),
        stream: undefined as any,
        destination: '',
        filename: '',
        path: '',
      },
    );

    expect(caregiverService.assertChildPermission).toHaveBeenCalled();
    expect(storageService.uploadFile).toHaveBeenCalled();
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: MediaType.IMAGE,
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      message: 'Task completed and reward points awarded successfully',
      data: {
        dayActivityId: 'activity-1',
        pointsEarned: 50,
        account: {
          userId: 'parent-1',
          balance: 50,
          lifetimeEarned: 50,
          lifetimeSpent: 0,
        },
      },
    });
  });

  it('runs parent breakfast no media then same task with media within 24 hours', async () => {
    const { service, prisma } = makeService();
    prisma.dayActivity.findUnique.mockResolvedValue({
      id: 'activity-1',
      title: 'Breakfast',
      category: 'RECIPE',
      description: null,
      proofMediaId: null,
      proofs: [],
      dayPlan: {
        childId: 'child-1',
        date: new Date('2026-08-22T00:00:00.000Z'),
        child: { id: 'child-1', name: 'Ava' },
      },
    });
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'BREAKFAST' },
      activity: null,
    });
    prisma.dayActivity.update.mockResolvedValue({ id: 'activity-1', status: ActivityStatus.COMPLETED });

    prisma.rewardLedgerEntry.findUnique.mockResolvedValueOnce(null);
    prisma.rewardAccount.upsert.mockResolvedValueOnce({
      userId: 'parent-1',
      balance: 20,
      lifetimeEarned: 20,
      lifetimeSpent: 0,
    });
    prisma.rewardLedgerEntry.create.mockResolvedValueOnce({
      id: 'earn-1',
      points: 20,
    });

    const first = await service.completeTaskForReward(
      { userId: 'parent-1', role: UserRole.PARENT } as any,
      'activity-1',
    );

    prisma.rewardLedgerEntry.findUnique.mockResolvedValueOnce({
      id: 'earn-1',
      userId: 'parent-1',
      entryType: RewardLedgerEntryType.EARN,
      sourceType: RewardLedgerSourceType.DAY_ACTIVITY,
      sourceId: 'activity-1',
      points: 20,
      balanceAfter: 20,
      description: 'Logged meal',
      metadata: { hasMedia: false },
      createdAt: new Date(),
    });
    prisma.rewardAccount.update = jest
      .fn()
      .mockResolvedValueOnce({
        userId: 'parent-1',
        balance: 50,
        lifetimeEarned: 50,
        lifetimeSpent: 0,
      });
    prisma.rewardLedgerEntry.create.mockResolvedValueOnce({
      id: 'adj-1',
      points: 30,
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        rewardLedgerEntry: prisma.rewardLedgerEntry,
        rewardAccount: {
          ...prisma.rewardAccount,
          update: prisma.rewardAccount.update,
          upsert: prisma.rewardAccount.upsert,
        },
      }),
    );

    const second = await service.completeTaskForReward(
      { userId: 'parent-1', role: UserRole.PARENT } as any,
      'activity-1',
      {
        fieldname: 'image',
        originalname: 'breakfast.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('abc'),
        stream: undefined as any,
        destination: '',
        filename: '',
        path: '',
      },
    );

    expect(first.data.pointsEarned).toBe(20);
    expect(second.data.pointsEarned).toBe(30);
    expect(second.data.account.balance).toBe(50);
  });

  it('runs nanny meal with image practical flow', async () => {
    const { service, prisma } = makeService();
    prisma.dayActivity.findUnique.mockResolvedValue({
      id: 'activity-2',
      title: 'Dinner',
      category: 'RECIPE',
      description: null,
      proofMediaId: null,
      proofs: [],
      dayPlan: {
        childId: 'child-1',
        date: new Date('2026-08-22T00:00:00.000Z'),
        child: { id: 'child-1', name: 'Ava' },
      },
    });
    prisma.childSchedule.findFirst.mockResolvedValue({
      recipe: { recipeMealType: 'DINNER' },
      activity: null,
    });
    prisma.dayActivity.update.mockResolvedValue({ id: 'activity-2', status: ActivityStatus.COMPLETED });
    prisma.rewardLedgerEntry.findUnique.mockResolvedValue(null);
    prisma.rewardLedgerEntry.create.mockResolvedValue({
      id: 'earn-2',
      points: 30,
    });
    prisma.rewardAccount.upsert.mockResolvedValue({
      userId: 'nanny-1',
      balance: 30,
      lifetimeEarned: 30,
      lifetimeSpent: 0,
    });

    const result = await service.completeTaskForReward(
      { userId: 'nanny-1', role: UserRole.NANNY } as any,
      'activity-2',
      {
        fieldname: 'image',
        originalname: 'dinner.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('abc'),
        stream: undefined as any,
        destination: '',
        filename: '',
        path: '',
      },
    );

    expect(result.data.pointsEarned).toBe(30);
    expect(result.data.account.balance).toBe(30);
  });
});
