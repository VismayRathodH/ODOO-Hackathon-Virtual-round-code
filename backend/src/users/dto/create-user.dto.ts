import { USER_ROLES } from '../../common/domain.types';
import type { UserRole } from '../../common/domain.types';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(7)
  password: string;

  @IsIn(USER_ROLES)
  role: UserRole;

  @IsOptional()
  @IsString()
  managerId?: string;
}