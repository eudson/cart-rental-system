import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CartStatus } from 'shared';

export class UpdateCartDto {
  @IsOptional()
  @Type(() => String)
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Type(() => String)
  @IsUUID()
  cartTypeId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(CartStatus)
  status?: CartStatus;
}
