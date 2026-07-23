import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateParentProfileDto,
  UpdateUserDto,
} from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        preferredLanguage: true,
        role: true,
        relationShip: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        parentProfile: {
          select: {
            street: true,
            city: true,
            state: true,
            country: true,
            postalCode: true,
          }
        }
      }
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let address: string | null = null;
    if (user.parentProfile) {
      const { street, city, state, country, postalCode } = user.parentProfile;
      const addressParts = [street, city, state, country, postalCode].filter(Boolean);
      address = addressParts.length > 0 ? addressParts.join(', ') : null;
    }

    const { parentProfile, ...restUser } = user;
    return {
      ...restUser,
      address,
    };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Ensure email and address fields are not updated
    const updateData = { ...updateUserDto };
    delete (updateData as any).email;
    delete (updateData as any).street;
    delete (updateData as any).city;
    delete (updateData as any).state;
    delete (updateData as any).country;
    delete (updateData as any).postCode;
    delete (updateData as any).postalCode;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        profilePictureUrl: true,
        preferredLanguage: true,
        role: true,
        relationShip: true,
      }
    });
  }

  async updateMyParentProfile(userId: string, dto: UpdateParentProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { parentProfile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data = {
      address: dto.address ?? user.parentProfile?.address ?? '',
      street: dto.street ?? user.parentProfile?.street ?? '',
      postalCode: dto.postalCode ?? user.parentProfile?.postalCode ?? '',
      city: dto.city ?? user.parentProfile?.city ?? '',
      state: dto.state ?? user.parentProfile?.state ?? '',
      country: dto.country ?? user.parentProfile?.country,
    };

    const profile = await this.prisma.parentProfile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        relationship: 'GUARDIAN',
        ...data,
      },
    });

    return {
      success: true,
      message: 'Parent profile updated',
      data: profile,
    };
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
      }
    });
  }

  async getUserDocuments(userId: string) {
    const documents = await this.prisma.kycDocument.findMany({
      where: {
        kycVerification: {
          userId,
        },
      },
    });
    return {
      success: true,
      data: documents,
    };
  }

  async getAssignedNanniesDocuments(parentId: string) {
    // Find all unique nannies linked to children of this parent
    const links = await this.prisma.nannyChildLink.findMany({
      where: {
        child: {
          parentUserId: parentId,
        },
      },
      select: {
        nannyUserId: true,
      },
    });

    const uniqueNannyIds = [...new Set(links.map(link => link.nannyUserId))];

    if (uniqueNannyIds.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch nannies and their KYC documents
    const nannies = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueNannyIds },
      },
      select: {
        id: true,
        fullName: true,
        profilePictureUrl: true,
        kycVerifications: {
          include: {
            documents: true,
          },
        },
      },
    });

    return {
      success: true,
      data: nannies.map(nanny => ({
        nannyId: nanny.id,
        nannyName: nanny.fullName,
        nannyProfilePicture: nanny.profilePictureUrl,
        documents: nanny.kycVerifications.flatMap(
          (verification) => verification.documents,
        ),
      })),
    };
  }
}
