import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
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
  @IsOptional()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contractMonths?: number;

  @IsOptional()
  @Type(() => String)
  @IsString()
  notes?: string;
}
