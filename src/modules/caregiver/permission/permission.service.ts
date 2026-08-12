import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CaregiverAccessRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaregiverService } from '../caregiver.service';
import { UpdateCaregiverPermissionsDto } from '../dto/update-caregiver-permissions.dto';
import {
  ManageFamilyAccessPermissionDto,
  ManageNannyAccessPermissionDto,
  ManageParentAccessPermissionDto,
} from './dto/manage-access-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    private readonly caregiverService: CaregiverService,
    private readonly prisma: PrismaService,
  ) {}

  getAccessPermissions(userId: string, accessId: string) {
    return this.caregiverService.getPermissions(userId, accessId);
  }

  async getNannyPermissions(userId: string, accessId: string) {
    await this.assertAccessRole(accessId, CaregiverAccessRole.NANNY);
    return this.caregiverService.getPermissions(userId, accessId);
  }

  async getParentPermissions(userId: string, accessId: string) {
    await this.assertAccessRole(accessId, CaregiverAccessRole.PARENT);
    return this.caregiverService.getPermissions(userId, accessId);
  }

  async getFamilyPermissions(userId: string, accessId: string) {
    await this.assertAccessRole(accessId, CaregiverAccessRole.FAMILY_MEMBER);
    return this.caregiverService.getPermissions(userId, accessId);
  }

  async saveNannyPermissions(
    userId: string,
    accessId: string,
    dto: ManageNannyAccessPermissionDto,
  ) {
    await this.assertAccessRole(accessId, CaregiverAccessRole.NANNY);
    return this.caregiverService.updatePermissions(userId, accessId, dto);
  }

  async saveParentPermissions(
    userId: string,
    accessId: string,
    dto: ManageParentAccessPermissionDto,
  ) {
    await this.assertAccessRole(accessId, CaregiverAccessRole.PARENT);
    return this.caregiverService.updatePermissions(userId, accessId, dto);
  }

  async saveFamilyPermissions(
    userId: string,
    accessId: string,
    dto: ManageFamilyAccessPermissionDto,
  ) {
    await this.assertAccessRole(accessId, CaregiverAccessRole.FAMILY_MEMBER);
    return this.caregiverService.updatePermissions(userId, accessId, dto);
  }

  updateAccess(
    userId: string,
    accessId: string,
    dto: UpdateCaregiverPermissionsDto,
  ) {
    return this.caregiverService.updatePermissions(userId, accessId, dto);
  }

  private async assertAccessRole(accessId: string, role: CaregiverAccessRole) {
    const access = await this.prisma.caregiverAccess.findUnique({
      where: { id: accessId },
      select: { role: true },
    });

    if (!access) {
      throw new NotFoundException('Caregiver access not found');
    }

    if (access.role !== role) {
      throw new BadRequestException(`This access is not a ${role} access`);
    }
  }
}
