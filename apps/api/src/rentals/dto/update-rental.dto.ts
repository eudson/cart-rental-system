import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateRentalDto {
  @IsOptional()
  @Type(() => String)
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  notes?: string;
}
