import { ApiProperty } from '@nestjs/swagger';
import { GroceryOrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePartnerOrderDto {
  @ApiProperty({
    enum: GroceryOrderStatus,
    example: GroceryOrderStatus.OUT_FOR_DELIVERY,
  })
  @IsEnum(GroceryOrderStatus)
  status!: GroceryOrderStatus;
}
