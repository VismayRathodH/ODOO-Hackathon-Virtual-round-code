import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ApprovalType } from '../common/domain.types';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateApprovalRuleDto } from './dto/create-approval-rule.dto';

@Injectable()
export class ApprovalRulesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(dto: CreateApprovalRuleDto, companyId: string) {
    const db = this.supabaseService.db;
    const stepsInput = dto.steps ?? [];

    const { data: rule, error: ruleError } = await db
      .from('ApprovalRule')
      .insert({
        companyId,
        name: dto.name,
        type: dto.type as ApprovalType,
        percentageThreshold: dto.percentageThreshold ?? null,
        specificApproverId: dto.specificApproverId ?? null,
      })
      .select('*')
      .single();

    if (ruleError || !rule) {
      throw new InternalServerErrorException('Failed to create approval rule');
    }

    if (stepsInput.length > 0) {
      const { error: stepsError } = await db.from('ApprovalStep').insert(
        stepsInput.map((step) => ({
          ruleId: rule.id,
          approverId: step.approverId,
          sequence: step.sequence,
          isManagerApprover: step.isManagerApprover,
        })),
      );

      if (stepsError) {
        await db.from('ApprovalRule').delete().eq('id', rule.id);
        throw new InternalServerErrorException('Failed to create approval steps');
      }
    }

    const { data: steps, error: fetchStepsError } = await db
      .from('ApprovalStep')
      .select('*')
      .eq('ruleId', rule.id)
      .order('sequence', { ascending: true });

    if (fetchStepsError) {
      throw new InternalServerErrorException('Failed to fetch approval steps');
    }

    return {
      ...rule,
      steps: steps ?? [],
    };
  }

  async findAll(companyId: string) {
    const db = this.supabaseService.db;

    const { data: rules, error: rulesError } = await db
      .from('ApprovalRule')
      .select('*')
      .eq('companyId', companyId)
      .order('createdAt', { ascending: false });

    if (rulesError || !rules) {
      throw new InternalServerErrorException('Failed to fetch approval rules');
    }

    if (rules.length === 0) {
      return [];
    }

    const ruleIds = rules.map((rule) => rule.id);
    const { data: steps, error: stepsError } = await db
      .from('ApprovalStep')
      .select('*')
      .in('ruleId', ruleIds)
      .order('sequence', { ascending: true });

    if (stepsError) {
      throw new InternalServerErrorException('Failed to fetch approval steps');
    }

    const approverIds = Array.from(
      new Set((steps ?? []).map((step) => step.approverId)),
    );
    const approversMap = new Map<string, { id: string; email: string }>();

    if (approverIds.length > 0) {
      const { data: approvers, error: approversError } = await db
        .from('User')
        .select('id,email')
        .eq('companyId', companyId)
        .in('id', approverIds);

      if (approversError) {
        throw new InternalServerErrorException('Failed to fetch approvers');
      }

      (approvers ?? []).forEach((approver) => {
        approversMap.set(approver.id, { id: approver.id, email: approver.email });
      });
    }

    return rules.map((rule) => {
      const ruleSteps = (steps ?? [])
        .filter((step) => step.ruleId === rule.id)
        .map((step) => ({
          ...step,
          approver: approversMap.get(step.approverId) ?? null,
        }));

      return {
        ...rule,
        steps: ruleSteps,
      };
    });
  }
}