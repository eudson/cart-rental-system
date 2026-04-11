import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RentalType } from 'shared';

export class CreateRentalDto {
  @Type(() => String)
  @IsEnum(RentalType)
  type!: RentalType;

  @Type(() => String)
  @IsUUID()
  customerId!: string;

  @Type(() => String)
  @IsUUID()
  cartId!: string;

  @Type(() => String)
  @IsDateString()
  startDate!: string;

  @Type(() => String)
  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  notes?: string;
}
