import { BadRequestException } from '@nestjs/common';

export function extractMembershipUserId(userParam: any): string {
  if (typeof userParam === 'string') {
    return userParam;
  }

  const userId = userParam?.userId ?? userParam?.id ?? userParam?.sub;
  if (!userId) {
    throw new BadRequestException(
      'User ID could not be identified from authentication token.',
    );
  }

  return userId;
}
