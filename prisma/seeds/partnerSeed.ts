import {
  PrismaClient,
  RewardOfferChannel,
  RewardOfferStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const PARTNER_EMAIL = 'partner@e.com';
const PARTNER_PASSWORD = '123456';

export async function seedPartnerRewards(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(PARTNER_PASSWORD, 10);

  const partner = await prisma.user.upsert({
    where: { email: PARTNER_EMAIL },
    update: {
      fullName: 'Serenity Spa Partner',
      passwordHash,
      role: UserRole.PARTNER,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
      profilePictureUrl:
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874',
    },
    create: {
      email: PARTNER_EMAIL,
      fullName: 'Serenity Spa Partner',
      passwordHash,
      role: UserRole.PARTNER,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
      verificationStatus: 'APPROVED',
      profilePictureUrl:
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874',
    },
  });

  const stores = await Promise.all(
    [
      {
        name: 'Dubai Mall',
        address: 'Downtown Dubai, Level LG',
        city: 'Dubai',
        latitude: 25.1972,
        longitude: 55.2796,
        mapUrl: 'https://maps.google.com/?q=25.1972,55.2796',
      },
      {
        name: 'Mall of the Emirates',
        address: 'Al Barsha 1, Ground Floor',
        city: 'Dubai',
        latitude: 25.1181,
        longitude: 55.2006,
        mapUrl: 'https://maps.google.com/?q=25.1181,55.2006',
      },
      {
        name: 'City Centre Mirdif',
        address: 'Mirdif, Level 1',
        city: 'Dubai',
        latitude: 25.2166,
        longitude: 55.4076,
        mapUrl: 'https://maps.google.com/?q=25.2166,55.4076',
      },
      {
        name: 'Yas Mall',
        address: 'Yas Island, Level G',
        city: 'Abu Dhabi',
        latitude: 24.4889,
        longitude: 54.6074,
        mapUrl: 'https://maps.google.com/?q=24.4889,54.6074',
      },
    ].map((store) => upsertPartnerStore(prisma, partner.id, store)),
  );

  await upsertPartnerOffer(prisma, {
    partnerUserId: partner.id,
    title: 'Serenity Spa',
    productName: 'Family wellness discount',
    description: 'Grab 25% discount with 300 Alurei',
    includedTitle: "What's included",
    includedDescription:
      'AED 30 instant discount. Applied directly at checkout on your total bill. AED 30 instant discount. Applied directly at checkout on your total bill.',
    terms:
      'AED 30 instant discount. Applied directly at checkout on your total bill. Cannot be combined with other offers.',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e',
    channel: RewardOfferChannel.BOTH,
    onlineCouponCode: 'ALUREI15',
    websiteUrl: 'https://www.serenityspa.example/alurei',
    pointsCost: 300,
    availableQuantity: 250,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2035-01-20T23:59:59.000Z'),
    storeIds: stores.map((store) => store.id),
  });

  await upsertPartnerOffer(prisma, {
    partnerUserId: partner.id,
    title: 'Serenity Spa',
    productName: 'Online family essentials voucher',
    description: 'Get online family essentials discount with 200 Alurei',
    includedTitle: 'Online voucher',
    includedDescription:
      'Use your coupon code on the Serenity Spa website checkout.',
    terms: 'Valid for online checkout only. One redemption per claim.',
    imageUrl: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af',
    channel: RewardOfferChannel.ONLINE,
    onlineCouponCode: 'ALUREI200',
    websiteUrl: 'https://www.serenityspa.example/family-essentials',
    pointsCost: 200,
    availableQuantity: 500,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2035-01-20T23:59:59.000Z'),
    storeIds: stores.slice(0, 2).map((store) => store.id),
  });

  await upsertPartnerOffer(prisma, {
    partnerUserId: partner.id,
    title: 'Serenity Spa',
    productName: 'In-store child care bundle',
    description: 'Claim an in-store care bundle with 500 Alurei',
    includedTitle: 'In-store QR reward',
    includedDescription:
      'Show your QR code at any selected branch to claim the bundle.',
    terms: 'Valid in selected stores only. Staff must scan the QR code.',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
    channel: RewardOfferChannel.IN_STORE,
    pointsCost: 500,
    availableQuantity: 120,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2035-01-20T23:59:59.000Z'),
    storeIds: stores.map((store) => store.id),
  });

  console.log(`Partner rewards seeded: ${partner.email}`);
}

async function upsertPartnerStore(
  prisma: PrismaClient,
  userId: string,
  store: {
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    mapUrl: string;
  },
) {
  const existing = await prisma.store.findFirst({
    where: { userId, name: store.name },
    select: { id: true },
  });

  const data = {
    userId,
    name: store.name,
    address: store.address,
    city: store.city,
    description: 'Serenity Spa reward redemption branch.',
    logoUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874',
    latitude: store.latitude,
    longitude: store.longitude,
    mapUrl: store.mapUrl,
  };

  return existing
    ? prisma.store.update({
        where: { id: existing.id },
        data,
      })
    : prisma.store.create({ data });
}

async function upsertPartnerOffer(
  prisma: PrismaClient,
  offer: {
    partnerUserId: string;
    title: string;
    productName: string;
    description: string;
    includedTitle: string;
    includedDescription: string;
    terms: string;
    imageUrl: string;
    channel: RewardOfferChannel;
    onlineCouponCode?: string;
    websiteUrl?: string;
    pointsCost: number;
    availableQuantity: number;
    startsAt: Date;
    endsAt: Date;
    storeIds: string[];
  },
) {
  const existing = await prisma.rewardOffer.findFirst({
    where: {
      partnerUserId: offer.partnerUserId,
      title: offer.title,
      productName: offer.productName,
    },
    select: { id: true },
  });

  const data = {
    partnerUserId: offer.partnerUserId,
    storeId: offer.storeIds[0],
    title: offer.title,
    productName: offer.productName,
    description: offer.description,
    includedTitle: offer.includedTitle,
    includedDescription: offer.includedDescription,
    terms: offer.terms,
    imageUrl: offer.imageUrl,
    channel: offer.channel,
    onlineCouponCode: offer.onlineCouponCode,
    websiteUrl: offer.websiteUrl,
    pointsCost: offer.pointsCost,
    availableQuantity: offer.availableQuantity,
    status: RewardOfferStatus.ACTIVE,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
  };

  if (existing) {
    return prisma.rewardOffer.update({
      where: { id: existing.id },
      data: {
        ...data,
        stores: {
          deleteMany: {},
          create: offer.storeIds.map((storeId) => ({ storeId })),
        },
      },
    });
  }

  return prisma.rewardOffer.create({
    data: {
      ...data,
      stores: {
        create: offer.storeIds.map((storeId) => ({ storeId })),
      },
    },
  });
}
