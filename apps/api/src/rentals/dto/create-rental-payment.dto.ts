import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from 'shared';

export class CreateRentalPaymentDto {
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @Type(() => String)
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @Type(() => String)
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  notes?: string;
}
