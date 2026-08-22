import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GroceryOrderStatus,
  PaymentMethodType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class GroceryCheckoutPreviewDto {
  @ApiPropertyOptional({
    example: 'parent-user-id',
    description:
      'Optional target parent user ID when a nanny is creating or previewing the order.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: ['shopping-item-id-1', 'shopping-item-id-2'],
    description:
      'Optional subset of shopping items to include. Defaults to all active shopping items for the selected kitchen owner.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @ApiPropertyOptional({
    example: 'store-id',
    description: 'Optional store to preview exact totals against.',
  })
  @IsOptional()
  @IsString()
  storeId?: string;
}

export class CreateGroceryOrderDto {
  @ApiPropertyOptional({
    example: 'parent-user-id',
    description:
      'Optional target parent user ID when a nanny is creating or previewing the order.',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: ['shopping-item-id-1', 'shopping-item-id-2'],
    description:
      'Optional subset of shopping items to include. Defaults to all active shopping items for the selected kitchen owner.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @ApiProperty({
    example: 'store-id',
    description: 'Selected partner store ID.',
  })
  @IsString()
  storeId!: string;

  @ApiPropertyOptional({
    example: 'Organic products only. Call before replacement.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  finalNote?: string;

  @ApiProperty({
    example: '4517 Washington Ave, Kentucky 39495',
    description: 'Delivery address shown on the order detail screen.',
  })
  @IsString()
  @MaxLength(500)
  deliveryAddress!: string;

  @ApiProperty({
    example: '+8801700000000',
    description: 'Receiver phone number used for delivery coordination.',
  })
  @IsString()
  receiverPhone!: string;

  @ApiProperty({
    enum: PaymentMethodType,
    example: PaymentMethodType.ONLINE,
  })
  @IsEnum(PaymentMethodType)
  paymentType!: PaymentMethodType;

  @ApiPropertyOptional({
    example: 'saved-payment-method-id',
    description:
      'Optional for ONLINE. If omitted, checkout can continue on a hosted Stripe payment page.',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

export enum GroceryOrderAction {
  CANCEL = 'CANCEL',
}

export class UpdateGroceryOrderDto {
  @ApiProperty({
    enum: GroceryOrderAction,
    example: GroceryOrderAction.CANCEL,
  })
  @IsEnum(GroceryOrderAction)
  action!: GroceryOrderAction;
}

export class UpdatePartnerGroceryOrderDto {
  @ApiProperty({
    enum: GroceryOrderStatus,
    example: GroceryOrderStatus.OUT_FOR_DELIVERY,
  })
  @IsEnum(GroceryOrderStatus)
  status!: GroceryOrderStatus;
}
