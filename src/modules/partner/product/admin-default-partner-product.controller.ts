import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  CreateDefaultPartnerProductDto,
  DefaultPartnerProductQueryDto,
  UpdateDefaultPartnerProductDto,
} from './dto/default-partner-product.dto';
import { PartnerProductService } from './partner-product.service';

@ApiTags('Admin Default Partner Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('partner/admin/default-products')
export class AdminDefaultPartnerProductController {
  constructor(private readonly partnerProductService: PartnerProductService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: get default partner products' })
  getAdminDefaultProducts(@Query() query: DefaultPartnerProductQueryDto) {
    return this.partnerProductService.getAdminDefaultProducts(query);
  }

  @Post()
  @ApiOperation({ summary: 'Admin: create a default partner product' })
  createAdminDefaultProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDefaultPartnerProductDto,
  ) {
    return this.partnerProductService.createAdminDefaultProduct(user, dto);
  }

  @Patch(':defaultProductId')
  @ApiOperation({ summary: 'Admin: update a default partner product' })
  @ApiParam({
    name: 'defaultProductId',
    description: 'Default partner product ID',
  })
  updateAdminDefaultProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('defaultProductId') defaultProductId: string,
    @Body() dto: UpdateDefaultPartnerProductDto,
  ) {
    return this.partnerProductService.updateAdminDefaultProduct(
      user,
      defaultProductId,
      dto,
    );
  }

  @Delete(':defaultProductId')
  @ApiOperation({ summary: 'Admin: archive a default partner product' })
  @ApiParam({
    name: 'defaultProductId',
    description: 'Default partner product ID',
  })
  deleteAdminDefaultProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('defaultProductId') defaultProductId: string,
  ) {
    return this.partnerProductService.deleteAdminDefaultProduct(
      user,
      defaultProductId,
    );
  }
}
