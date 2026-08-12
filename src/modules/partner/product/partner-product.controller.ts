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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
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
  CreatePartnerProductDto,
  PartnerProductQueryDto,
  UpdatePartnerProductDto,
} from './dto/create-partner-product.dto';
import { PartnerProductService } from './partner-product.service';

@ApiTags('Partner Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARTNER)
@Controller('partner/products')
export class PartnerProductController {
  constructor(private readonly partnerProductService: PartnerProductService) {}

  @Get()
  @ApiOperation({
    summary: 'Get partner products',
    description:
      'Lists products owned by the logged-in partner. Use search for product-name suggestions while creating offers.',
  })
  getProducts(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PartnerProductQueryDto,
  ) {
    return this.partnerProductService.getProducts(user, query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get one partner product by ID' })
  @ApiParam({ name: 'productId', description: 'Partner product ID' })
  @ApiResponse({ status: 200, description: 'Partner product fetched.' })
  @ApiResponse({
    status: 404,
    description: 'Product not found or does not belong to this partner.',
  })
  getProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId') productId: string,
  ) {
    return this.partnerProductService.getProduct(user, productId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create partner product draft or published product',
    description:
      'Builds the Add Product panel flow. Use status=DRAFT for Save draft and status=PUBLISHED for Publish Product.',
  })
  @ApiBody({
    type: CreatePartnerProductDto,
    examples: {
      publish: {
        summary: 'Publish Product',
        value: {
          productName: 'Baby Organic Yogurt',
          category: 'BABY',
          sku: 'SKU-001',
          tags: ['yogurt meal', 'apple juice'],
          price: 12.5,
          unit: 'LITER',
          availability: 'IN_STOCK',
          status: 'PUBLISHED',
        },
      },
      draft: {
        summary: 'Save Draft',
        value: {
          productName: 'Fresh Milk Pack',
          category: 'DAIRY',
          sku: 'SKU-002',
          tags: 'milk, dairy',
          price: 8,
          unit: 'PACK',
          availability: 'LIMITED',
          status: 'DRAFT',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Partner product created.' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, non-partner user, or duplicate SKU.',
  })
  createProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePartnerProductDto,
  ) {
    return this.partnerProductService.createProduct(user, dto);
  }

  @Patch(':productId')
  @ApiOperation({
    summary: 'Update partner product',
    description:
      'Updates a product owned by the logged-in partner. Send only the fields that changed.',
  })
  @ApiParam({ name: 'productId', description: 'Partner product ID' })
  @ApiBody({
    type: UpdatePartnerProductDto,
    examples: {
      updateProduct: {
        summary: 'Update Product',
        value: {
          productName: 'Baby Organic Yogurt - Large',
          category: 'BABY',
          sku: 'SKU-001',
          tags: ['yogurt meal', 'apple juice', 'organic'],
          price: 14.75,
          unit: 'LITER',
          availability: 'IN_STOCK',
          status: 'PUBLISHED',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Partner product updated.' })
  @ApiResponse({
    status: 404,
    description: 'Product not found or does not belong to this partner.',
  })
  updateProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdatePartnerProductDto,
  ) {
    return this.partnerProductService.updateProduct(user, productId, dto);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Delete partner product' })
  @ApiParam({ name: 'productId', description: 'Partner product ID' })
  @ApiResponse({ status: 200, description: 'Partner product deleted.' })
  @ApiResponse({
    status: 404,
    description: 'Product not found or does not belong to this partner.',
  })
  deleteProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('productId') productId: string,
  ) {
    return this.partnerProductService.deleteProduct(user, productId);
  }
}
