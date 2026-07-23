import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AddChildDto } from '../dto/add-child.dto';
import { UpdateChildDto } from '../dto/update-child.dto';

@Injectable()
export class ChildService {
  constructor(private readonly prisma: PrismaService) {}

  async addChild(parentUserId: string, dto: AddChildDto) {
    const child = await this.prisma.child.create({
      data: {
        parentUserId,
        name: dto.name,
        gender: dto.gender,
        weight: dto.weight,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });

    return {
      message: 'Child added successfully',
      data: child,
    };
  }

  async getChildren(parentUserId: string) {
    const children = await this.prisma.child.findMany({
      where: { parentUserId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Children fetched successfully',
      data: children,
    };
  }

  async getChildById(parentUserId: string, childId: string) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      include: {
        schoolSchedule: true,
        recurringActivities: true,
        naps: true,
      },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (child.parentUserId !== parentUserId) {
      throw new ForbiddenException('You do not have access to this child');
    }

    return {
      message: 'Child fetched successfully',
      data: child,
    };
  }

  async updateChild(parentUserId: string, childId: string, dto: UpdateChildDto) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (child.parentUserId !== parentUserId) {
      throw new ForbiddenException('You do not have access to this child');
    }

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.wakeUpTime !== undefined && { wakeUpTime: dto.wakeUpTime }),
        ...(dto.bedTime !== undefined && { bedTime: dto.bedTime }),
        ...(dto.healthConditions !== undefined && { healthConditions: dto.healthConditions }),
        ...(dto.additionalNotes !== undefined && { additionalNotes: dto.additionalNotes }),
        
        ...(dto.schoolSchedule && {
          schoolSchedule: {
            upsert: {
              create: dto.schoolSchedule,
              update: dto.schoolSchedule,
            },
          },
        }),
        
        ...(dto.recurringActivities && {
          recurringActivities: {
            deleteMany: {},
            create: dto.recurringActivities,
          },
        }),
        
        ...(dto.naps && {
          naps: {
            deleteMany: {},
            create: dto.naps,
          },
        }),
      },
      include: {
        schoolSchedule: true,
        recurringActivities: true,
        naps: true,
      },
    });

    return {
      message: 'Child updated successfully',
      data: updated,
    };
  }

  async deleteChild(parentUserId: string, childId: string) {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
    });

    if (!child) {
      throw new NotFoundException('Child not found');
    }

    if (child.parentUserId !== parentUserId) {
      throw new ForbiddenException('You do not have access to this child');
    }

    await this.prisma.child.delete({ where: { id: childId } });

    return { message: 'Child deleted successfully' };
  }
}
