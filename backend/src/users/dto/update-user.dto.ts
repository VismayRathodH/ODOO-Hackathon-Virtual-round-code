import { USER_ROLES } from '../../common/domain.types';
import type { UserRole } from '../../common/domain.types';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsString()
  managerId?: string | null;
}