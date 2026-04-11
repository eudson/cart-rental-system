import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateLeaseContractDto {
  @IsOptional()
  @Type(() => String)
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  documentUrl?: string;
}
