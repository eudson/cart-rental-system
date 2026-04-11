import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RentalType } from 'shared';

export class ListCartAvailabilityQueryDto {
  @Type(() => String)
  @IsDateString()
  startDate!: string;

  @Type(() => String)
  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  locationId?: string;

  @Type(() => String)
  @IsEnum(RentalType)
  type!: RentalType;
}
