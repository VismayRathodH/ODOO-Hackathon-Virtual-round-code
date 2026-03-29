import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApprovalRulesService } from './approval-rules.service';
import { CreateApprovalRuleDto } from './dto/create-approval-rule.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('approval-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalRulesController {
  constructor(private readonly approvalRulesService: ApprovalRulesService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateApprovalRuleDto, @Req() req: AuthenticatedRequest) {
    return this.approvalRulesService.create(dto, this.requireCompanyId(req.user));
  }

  @Get()
  @Roles('ADMIN')
  findAll(@Req() req: AuthenticatedRequest) {
    return this.approvalRulesService.findAll(this.requireCompanyId(req.user));
  }

  private requireCompanyId(user: JwtPayload): string {
    if (!user.companyId) {
      throw new ForbiddenException('No company in token');
    }

    return user.companyId;
  }
}