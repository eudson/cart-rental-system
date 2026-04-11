import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateLeaseContractDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contractMonths!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  earlyTerminationFee?: number;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  documentUrl?: string;
}
