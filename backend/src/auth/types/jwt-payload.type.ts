import { UserRole } from '../../common/domain.types';

export interface JwtPayload {
  sub: string;
  userId: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}