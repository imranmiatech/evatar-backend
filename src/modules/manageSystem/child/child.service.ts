import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaregiverService } from '../caregiver/caregiver.service';

@Injectable()
export class ChildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caregiverService: CaregiverService,
  ) {}

  /**
   * Screen 2: Select Child List (with avatar & formatted age)
   */
  async getMyChildren(userId: string) {
    const accessibleChildIds =
      await this.caregiverService.getAccessibleChildIds(userId);

    const children =
      accessibleChildIds.length === 0
        ? []
        : await this.prisma.child.findMany({
            where: { id: { in: accessibleChildIds } },
            select: {
              id: true,
              name: true,
              avatar: true,
              birthDate: true,
              parentUserId: true,
              parentUser: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  profilePictureUrl: true,
                },
              },
            },
            orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
          });

    return {
      success: true,
      message: 'Children fetched successfully',
      data: children.map((child) => {
        const age = this.formatChildPickerAge(child.birthDate);

        return {
          id: child.id,
          name: child.name,
          image: child.avatar,
          avatar: child.avatar,
          birthDate: child.birthDate,
          age,
          ageLabel: age?.label ?? null,
          isAccountOwner: child.parentUserId === userId,
          accountOwner: {
            id: child.parentUser.id,
            name: child.parentUser.fullName,
            email: child.parentUser.email,
            image: child.parentUser.profilePictureUrl,
          },
        };
      }),
    };
  }

  private formatChildPickerAge(birthDate?: Date | null) {
    if (!birthDate) return null;
    const now = new Date();
    const birth = new Date(birthDate);

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();

    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
      years--;
      months += 12;
    }

    if (now.getDate() < birth.getDate() && months > 0) {
      months--;
    }

    let label = '';
    if (years > 0 && months > 0) {
      label = `${years} yrs ${months} mos`;
    } else if (years > 0) {
      label = `${years} yrs`;
    } else {
      label = `${months} mos`;
    }

    return { years, months, label };
  }
}
