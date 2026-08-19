import { Injectable } from '@nestjs/common';
import { CaregiverService, PermissionKey } from './caregiver/caregiver.service';
import { SearchManageSystemDto } from './caregiver/dto/search-manage-system.dto';
import { UpdateManageSystemPermissionsDto } from './caregiver/dto/update-manage-system-permissions.dto';
import { ChildService } from './child/child.service';
import { CreateManageSystemInvitationDto } from './invitation/dto/create-manage-system-invitation.dto';
import { InvitationService } from './invitation/invitation.service';

@Injectable()
export class ManageSystemService {
  constructor(
    private readonly caregiverService: CaregiverService,
    private readonly childService: ChildService,
    private readonly invitationService: InvitationService,
  ) {}

  // Caregiver Features Delegation
  getManageCaregivers(userId: string) {
    return this.caregiverService.getManageCaregivers(userId);
  }

  searchUsers(userId: string, dto: SearchManageSystemDto) {
    return this.caregiverService.searchUsers(userId, dto);
  }

  getPermissions(userId: string, accessId: string) {
    return this.caregiverService.getPermissions(userId, accessId);
  }

  updatePermissions(
    userId: string,
    accessId: string,
    dto: UpdateManageSystemPermissionsDto,
  ) {
    return this.caregiverService.updatePermissions(userId, accessId, dto);
  }

  removeAccess(userId: string, accessId: string) {
    return this.caregiverService.removeAccess(userId, accessId);
  }

  getAccessibleChildIds(userId: string, requiredPermission?: PermissionKey) {
    return this.caregiverService.getAccessibleChildIds(userId, requiredPermission);
  }

  assertChildPermission(
    userId: string,
    childId: string,
    permission: PermissionKey,
  ) {
    return this.caregiverService.assertChildPermission(
      userId,
      childId,
      permission,
    );
  }

  // Child Features Delegation
  getMyChildren(userId: string) {
    return this.childService.getMyChildren(userId);
  }

  // Invitation Features Delegation
  createInvitation(
    inviterUserId: string,
    childId: string,
    dto: CreateManageSystemInvitationDto,
  ) {
    return this.invitationService.createInvitation(inviterUserId, childId, dto);
  }

  previewInvitation(token: string) {
    return this.invitationService.previewInvitation(token);
  }

  acceptInvitation(userId: string, token: string) {
    return this.invitationService.acceptInvitation(userId, token);
  }

  declineInvitation(userId: string, token: string) {
    return this.invitationService.declineInvitation(userId, token);
  }

  acceptInvitationHtml(token: string) {
    return this.invitationService.acceptInvitationHtml(token);
  }

  acceptSignupInvitation(dto: {
    token: string;
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role?: string;
  }) {
    return this.invitationService.acceptSignupInvitation(dto);
  }

  declineInvitationHtml(token: string) {
    return this.invitationService.declineInvitationHtml(token);
  }
}
