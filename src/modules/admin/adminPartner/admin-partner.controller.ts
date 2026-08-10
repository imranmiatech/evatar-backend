import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminPartnerService } from './admin-partner.service';

@ApiTags('Admin Partner')
@ApiBearerAuth()
@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPartnerController {
  constructor(private readonly adminPartnerService: AdminPartnerService) {}

  @Get()
  @ApiOperation({ summary: 'Get admin partner list' })
  @ApiResponse({ status: 200, description: 'Return admin partner list.' })
  async getPartners() {
    return this.adminPartnerService.getPartners();
  }
}
