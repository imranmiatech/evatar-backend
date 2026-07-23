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
        name: dto.name,
        gender: dto.gender,
        weight: dto.weight,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        avatar: dto.avatar,
        wakeUpTime: dto.wakeUpTime,
        bedTime: dto.bedTime,
        healthConditions: dto.healthConditions ?? [],
        additionalNotes: dto.additionalNotes,
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
