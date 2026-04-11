import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CartStatus } from 'shared';

export class UpdateCartDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  locationId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
