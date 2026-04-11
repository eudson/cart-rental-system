import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RentalType } from 'shared';

export class ListCartAvailabilityQueryDto {
  @Type(() => String)
  @IsDateString()
  startDate!: string;

  @Type(() => String)
  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Type(() => String)
  @IsUUID()
  locationId?: string;

  @Type(() => String)
  @IsEnum(RentalType)
  type!: RentalType;
}
