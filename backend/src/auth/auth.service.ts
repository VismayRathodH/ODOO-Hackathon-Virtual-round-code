import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { UserRole } from '../common/domain.types';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const db = this.supabaseService.db;

    const { data: existingUser, error: existingUserError } = await db
      .from('User')
      .select('id')
      .eq('email', dto.email)
      .maybeSingle();

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to check existing user');
    }

    if (existingUser) {
      throw new BadRequestException('Email is already in use');
    }

    const domain = this.extractEmailDomain(dto.email);
    const { data: domainUser, error: domainUserError } = await db
      .from('User')
      .select('id,companyId')
      .ilike('email', `%@${domain}`)
      .limit(1)
      .maybeSingle();

    if (domainUserError && domainUserError.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to resolve company context');
    }

    let companyId = domainUser?.companyId ?? null;
    let role = dto.role ?? 'EMPLOYEE';

    if (!domainUser) {
      const { data: company, error: companyError } = await db
        .from('Company')
        .insert({
          name: this.domainToCompanyName(domain),
          currency: 'USD',
        })
        .select('id')
        .single();

      if (companyError || !company) {
        throw new InternalServerErrorException('Failed to create company');
      }

      companyId = company.id;
      role = 'ADMIN';
    }

    const passwordHash = await hash(dto.password, 10);

    const { data: user, error: userError } = await db
      .from('User')
      .insert({
        email: dto.email,
        passwordHash,
        name: dto.name ?? null,
        role,
        companyId,
      })
      .select('id,email,name,role,companyId,createdAt')
      .single();

    if (userError || !user) {
      throw new InternalServerErrorException('Failed to create user');
    }

    const accessToken = await this.issueAccessToken({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      companyId: user.companyId,
    });

    return {
      access_token: accessToken,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        createdAt: user.createdAt,
      },
    };
  }

  async login(dto: LoginDto) {
    const db = this.supabaseService.db;

    const { data: user, error } = await db
      .from('User')
      .select('id,email,name,role,companyId,createdAt,passwordHash')
      .eq('email', dto.email)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to authenticate user');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.issueAccessToken({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      companyId: user.companyId,
    });

    return {
      access_token: accessToken,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        createdAt: user.createdAt,
      },
    };
  }

  async me(userId: string) {
    const { data: user, error } = await this.supabaseService.db
      .from('User')
      .select('id,email,name,role,createdAt,updatedAt')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch user profile');
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async issueAccessToken(user: {
    id: string;
    email: string;
    role: UserRole;
    companyId: string | null;
  }): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  }

  private extractEmailDomain(email: string): string {
    const [, domain] = email.split('@');

    if (!domain) {
      throw new BadRequestException('Invalid email domain');
    }

    return domain.toLowerCase();
  }

  private domainToCompanyName(domain: string): string {
    const primary = domain.split('.')[0] ?? domain;
    if (!primary) {
      return 'New Company';
    }

    return primary.charAt(0).toUpperCase() + primary.slice(1);
  }
}