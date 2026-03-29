import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.create(
      dto,
      req.user.userId,
      this.requireCompanyId(req.user),
    );
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.expensesService.findAll(
      {
        userId: req.user.userId,
        role: req.user.role,
        companyId: this.requireCompanyId(req.user),
      },
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.expensesService.findOne(id, {
      userId: req.user.userId,
      role: req.user.role,
      companyId: this.requireCompanyId(req.user),
    });
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.expensesService.approve(id, req.user.userId);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  reject(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body('comment') comment?: string,
  ) {
    return this.expensesService.reject(id, req.user.userId, comment);
  }

  @Post(':id/override')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  override(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.expensesService.override(
      id,
      req.user.userId,
      this.requireCompanyId(req.user),
    );
  }

  private requireCompanyId(user: JwtPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('No company in token');
    }

    return user.companyId;
  }
}