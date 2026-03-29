import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { UserRole } from '../common/domain.types';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private mapUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    companyId: string | null;
    managerId: string | null;
    createdAt: string;
    updatedAt: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      managerId: user.managerId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll(companyId: string) {
    const { data, error } = await this.supabaseService.db
      .from('User')
      .select('id,email,name,role,companyId,managerId,createdAt,updatedAt')
      .eq('companyId', companyId)
      .order('createdAt', { ascending: false });

    if (error || !data) {
      throw new InternalServerErrorException('Failed to fetch users');
    }

    return data.map((user) => this.mapUser(user));
  }

  async findOne(id: string, companyId: string) {
    const { data: user, error } = await this.supabaseService.db
      .from('User')
      .select('id,email,name,role,companyId,managerId,createdAt,updatedAt')
      .eq('id', id)
      .eq('companyId', companyId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch user');
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUser(user);
  }

  async create(dto: CreateUserDto, companyId: string) {
    if (dto.managerId) {
      await this.findOne(dto.managerId, companyId);
    }

    const passwordHash = await hash(dto.password, 10);

    const { data, error } = await this.supabaseService.db
      .from('User')
      .insert({
        name: dto.name ?? null,
        email: dto.email,
        passwordHash,
        role: dto.role,
        companyId,
        managerId: dto.managerId ?? null,
      })
      .select('id,email,name,role,companyId,managerId,createdAt,updatedAt')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException('Email is already in use');
      }

      throw new InternalServerErrorException('Failed to create user');
    }

    return this.mapUser(data);
  }

  async update(id: string, dto: UpdateUserDto, companyId: string) {
    await this.findOne(id, companyId);

    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException('User cannot be their own manager');
      }

      await this.findOne(dto.managerId, companyId);
    }

    const updateData: Record<string, unknown> = {};

    if (dto.role) {
      updateData.role = dto.role as UserRole;
    }

    if (dto.managerId !== undefined) {
      updateData.managerId = dto.managerId;
    }

    const { data: updated, error } = await this.supabaseService.db
      .from('User')
      .update(updateData)
      .eq('id', id)
      .eq('companyId', companyId)
      .select('id,email,name,role,companyId,managerId,createdAt,updatedAt')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to update user');
    }

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return this.mapUser(updated);
  }
}