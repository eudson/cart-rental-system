import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

const MANAGEABLE_USER_ROLES = ['org_admin', 'staff'] as const;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(MANAGEABLE_USER_ROLES)
  role?: (typeof MANAGEABLE_USER_ROLES)[number];

  @IsOptional()
  @Type(() => String)
  @IsUUID()
  locationId?: string;
}
