export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface Company {
  id: string;
  name: string;
  currency: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId?: string | null;
  company?: Company | null;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  accessToken?: string;
}
