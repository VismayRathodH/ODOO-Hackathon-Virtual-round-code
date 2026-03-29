import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalRuleRecord,
  ApprovalStepRecord,
  CompanyRecord,
  ExpenseRecord,
  UserRecord,
} from '../common/domain.types';
import { CurrencyService } from '../currency/currency.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

type ExpenseActor = {
  userId: string;
  role: string;
  companyId: string;
};

type ExpenseWithUser = ExpenseRecord & {
  user?: {
    id: string;
    email: string;
    managerId?: string | null;
    companyId?: string | null;
  };
};

@Injectable()
export class ExpensesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly currencyService: CurrencyService,
  ) {}

  async create(dto: CreateExpenseDto, userId: string, companyId: string) {
    const company = await this.getCompany(companyId);

    const convertedAmount = await this.currencyService.convert(
      dto.amount,
      dto.currency,
      company.currency,
    );

    const { data: expense, error } = await this.supabaseService.db
      .from('Expense')
      .insert({
        userId,
        amount: dto.amount,
        currency: dto.currency,
        convertedAmount,
        companyCurrency: company.currency,
        category: dto.category,
        description: dto.description,
        date: new Date(dto.date).toISOString(),
        receiptUrl: dto.receiptUrl ?? null,
        status: 'PENDING',
        currentStep: 0,
      })
      .select('*')
      .single();

    if (error || !expense) {
      throw new InternalServerErrorException('Failed to create expense');
    }

    await this.initApprovalWorkflow(expense.id, userId, companyId);

    const refreshed = await this.getExpenseById(expense.id);
    const submitter = await this.getUserById(userId, companyId);

    return this.toExpenseResponse({
      ...refreshed,
      user: {
        id: submitter.id,
        email: submitter.email,
      },
    });
  }

  async findAll(user: ExpenseActor, status?: string) {
    let visibleUserIds: string[] = [];

    if (user.role === 'EMPLOYEE') {
      visibleUserIds = [user.userId];
    }

    if (user.role === 'MANAGER') {
      const { data: team, error } = await this.supabaseService.db
        .from('User')
        .select('id')
        .eq('companyId', user.companyId)
        .eq('managerId', user.userId);

      if (error) {
        throw new InternalServerErrorException('Failed to resolve team expenses');
      }

      visibleUserIds = (team ?? []).map((member) => member.id);
    }

    if (user.role === 'ADMIN') {
      const { data: allUsers, error } = await this.supabaseService.db
        .from('User')
        .select('id')
        .eq('companyId', user.companyId);

      if (error) {
        throw new InternalServerErrorException('Failed to resolve company users');
      }

      visibleUserIds = (allUsers ?? []).map((member) => member.id);
    }

    if (visibleUserIds.length === 0) {
      return [];
    }

    let query = this.supabaseService.db
      .from('Expense')
      .select('*')
      .in('userId', visibleUserIds)
      .order('createdAt', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: expenses, error } = await query;

    if (error || !expenses) {
      throw new InternalServerErrorException('Failed to fetch expenses');
    }

    const userMap = await this.getUsersMapByIds(visibleUserIds, user.companyId);

    return expenses.map((expense) =>
      this.toExpenseResponse({
        ...expense,
        user: userMap.get(expense.userId)
          ? {
              id: userMap.get(expense.userId)!.id,
              email: userMap.get(expense.userId)!.email,
            }
          : undefined,
      }),
    );
  }

  async findOne(id: string, user: ExpenseActor) {
    const expense = await this.getExpenseById(id);
    const owner = await this.getUserById(expense.userId, user.companyId);

    if (user.role === 'EMPLOYEE' && expense.userId !== user.userId) {
      throw new ForbiddenException();
    }

    if (user.role === 'MANAGER' && owner.managerId !== user.userId) {
      throw new ForbiddenException();
    }

    if (user.role === 'ADMIN' && owner.companyId !== user.companyId) {
      throw new ForbiddenException();
    }

    return this.toExpenseResponse({
      ...expense,
      user: {
        id: owner.id,
        email: owner.email,
        managerId: owner.managerId,
        companyId: owner.companyId,
      },
    });
  }

  async approve(expenseId: string, approverId: string) {
    const expense = await this.getExpenseById(expenseId);
    const approver = await this.getUserByIdAnyCompany(approverId);
    const submitter = await this.getUserByIdAnyCompany(expense.userId);

    if (!approver.companyId || approver.companyId !== submitter.companyId) {
      throw new ForbiddenException('Forbidden');
    }

    if (expense.currentApproverId !== approverId) {
      throw new ForbiddenException('You are not the current approver');
    }

    const { error: logError } = await this.supabaseService.db.from('ApprovalLog').insert({
      expenseId,
      approverId,
      action: 'APPROVED',
      stepSequence: expense.currentStep,
    });

    if (logError) {
      throw new InternalServerErrorException('Failed to write approval log');
    }

    const rule = await this.getRuleWithSteps(submitter.companyId);

    if (!rule || rule.steps.length === 0) {
      await this.updateExpense(expenseId, {
        status: 'APPROVED',
        currentApproverId: null,
      });

      return this.toExpenseResponse(await this.getExpenseById(expenseId));
    }

    const nextStep = rule.steps.find((step) => step.sequence > expense.currentStep);

    if (nextStep) {
      await this.updateExpense(expenseId, {
        currentStep: nextStep.sequence,
        currentApproverId: nextStep.approverId,
      });
    } else {
      await this.updateExpense(expenseId, {
        status: 'APPROVED',
        currentApproverId: null,
      });
    }

    if (rule.type === 'CONDITIONAL' || rule.type === 'HYBRID') {
      await this.checkConditionalApproval(expenseId, rule);
    }

    return this.toExpenseResponse(await this.getExpenseById(expenseId));
  }

  async reject(expenseId: string, approverId: string, comment?: string) {
    const expense = await this.getExpenseById(expenseId);
    const approver = await this.getUserByIdAnyCompany(approverId);
    const submitter = await this.getUserByIdAnyCompany(expense.userId);

    if (!approver.companyId || approver.companyId !== submitter.companyId) {
      throw new ForbiddenException('Forbidden');
    }

    if (expense.currentApproverId !== approverId) {
      throw new ForbiddenException('Not your turn');
    }

    const { error: logError } = await this.supabaseService.db.from('ApprovalLog').insert({
      expenseId,
      approverId,
      action: 'REJECTED',
      comment: comment ?? null,
      stepSequence: expense.currentStep,
    });

    if (logError) {
      throw new InternalServerErrorException('Failed to write rejection log');
    }

    await this.updateExpense(expenseId, {
      status: 'REJECTED',
      currentApproverId: null,
    });

    return this.toExpenseResponse(await this.getExpenseById(expenseId));
  }

  async override(expenseId: string, approverId: string, companyId: string) {
    const expense = await this.getExpenseById(expenseId);
    const submitter = await this.getUserById(expense.userId, companyId);

    if (!submitter) {
      throw new NotFoundException();
    }

    const { error: logError } = await this.supabaseService.db.from('ApprovalLog').insert({
      expenseId,
      approverId,
      action: 'APPROVED',
      comment: 'Admin override',
      stepSequence: 0,
    });

    if (logError) {
      throw new InternalServerErrorException('Failed to write override log');
    }

    await this.updateExpense(expenseId, {
      status: 'APPROVED',
      currentApproverId: null,
    });

    return this.toExpenseResponse(await this.getExpenseById(expenseId));
  }

  private async initApprovalWorkflow(
    expenseId: string,
    submitterId: string,
    companyId: string,
  ) {
    const rule = await this.getRuleWithSteps(companyId);

    if (!rule || rule.steps.length === 0) {
      const fallbackApproverId = await this.resolveFallbackApproverId(
        submitterId,
        companyId,
      );

      if (!fallbackApproverId) {
        await this.updateExpense(expenseId, {
          status: 'APPROVED',
          currentApproverId: null,
        });
        return;
      }

      await this.updateExpense(expenseId, {
        status: 'PENDING',
        currentStep: 0,
        currentApproverId: fallbackApproverId,
      });
      return;
    }

    const firstStep = rule.steps[0];
    let currentApproverId = firstStep.approverId;

    if (firstStep.isManagerApprover) {
      const submitter = await this.getUserById(submitterId, companyId);
      if (submitter.managerId) {
        currentApproverId = submitter.managerId;
      }
    }

    await this.updateExpense(expenseId, {
      currentStep: 0,
      currentApproverId,
    });
  }

  private async checkConditionalApproval(
    expenseId: string,
    rule: ApprovalRuleRecord & { steps: ApprovalStepRecord[] },
  ) {
    const totalSteps = rule.steps.length;

    const { count, error: countError } = await this.supabaseService.db
      .from('ApprovalLog')
      .select('id', { count: 'exact', head: true })
      .eq('expenseId', expenseId)
      .eq('action', 'APPROVED');

    if (countError) {
      throw new InternalServerErrorException('Failed to evaluate conditional approval');
    }

    const approvedLogs = count ?? 0;
    let shouldAutoApprove = false;

    if (rule.percentageThreshold && totalSteps > 0) {
      if ((approvedLogs / totalSteps) * 100 >= rule.percentageThreshold) {
        shouldAutoApprove = true;
      }
    }

    if (rule.specificApproverId) {
      const { data: specificApproved, error: specificError } =
        await this.supabaseService.db
          .from('ApprovalLog')
          .select('id')
          .eq('expenseId', expenseId)
          .eq('approverId', rule.specificApproverId)
          .eq('action', 'APPROVED')
          .maybeSingle();

      if (specificError && specificError.code !== 'PGRST116') {
        throw new InternalServerErrorException('Failed to evaluate conditional approver');
      }
      if (specificApproved) {
        shouldAutoApprove = true;
      }
    }

    if (shouldAutoApprove) {
      await this.updateExpense(expenseId, {
        status: 'APPROVED',
        currentApproverId: null,
      });
    }
  }

  private async getCompany(companyId: string): Promise<CompanyRecord> {
    const { data, error } = await this.supabaseService.db
      .from('Company')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch company');
    }

    if (!data) {
      throw new NotFoundException('Company not found');
    }

    return data as CompanyRecord;
  }

  private async getExpenseById(id: string): Promise<ExpenseRecord> {
    const { data, error } = await this.supabaseService.db
      .from('Expense')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch expense');
    }

    if (!data) {
      throw new NotFoundException();
    }

    return data as ExpenseRecord;
  }

  private async getUserById(id: string, companyId: string): Promise<UserRecord> {
    const { data, error } = await this.supabaseService.db
      .from('User')
      .select('id,email,passwordHash,name,role,companyId,managerId,createdAt,updatedAt')
      .eq('id', id)
      .eq('companyId', companyId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch user');
    }

    if (!data) {
      throw new NotFoundException('User not found');
    }

    return {
      id: data.id,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      companyId: data.companyId,
      managerId: data.managerId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as UserRecord;
  }

  private async getUserByIdAnyCompany(id: string): Promise<UserRecord> {
    const { data, error } = await this.supabaseService.db
      .from('User')
      .select('id,email,passwordHash,name,role,companyId,managerId,createdAt,updatedAt')
      .eq('id', id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch user');
    }

    if (!data) {
      throw new NotFoundException('User not found');
    }

    return {
      id: data.id,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      companyId: data.companyId,
      managerId: data.managerId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as UserRecord;
  }

  private async getUsersMapByIds(userIds: string[], companyId: string) {
    const userMap = new Map<string, { id: string; email: string }>();

    if (userIds.length === 0) {
      return userMap;
    }

    const { data, error } = await this.supabaseService.db
      .from('User')
      .select('id,email')
      .eq('companyId', companyId)
      .in('id', userIds);

    if (error) {
      throw new InternalServerErrorException('Failed to fetch users');
    }

    (data ?? []).forEach((user) => {
      userMap.set(user.id, { id: user.id, email: user.email });
    });

    return userMap;
  }

  private async resolveFallbackApproverId(
    submitterId: string,
    companyId: string,
  ): Promise<string | null> {
    const submitter = await this.getUserById(submitterId, companyId);

    if (submitter.managerId && submitter.managerId !== submitterId) {
      return submitter.managerId;
    }

    const admin = await this.getFirstUserByRole(companyId, 'ADMIN', submitterId);
    if (admin) {
      return admin;
    }

    const manager = await this.getFirstUserByRole(companyId, 'MANAGER', submitterId);
    if (manager) {
      return manager;
    }

    // As a last fallback, allow self-approval if the submitter is an approver role.
    const selfAdmin = await this.getFirstUserByRole(companyId, 'ADMIN');
    if (selfAdmin) {
      return selfAdmin;
    }

    const selfManager = await this.getFirstUserByRole(companyId, 'MANAGER');
    if (selfManager) {
      return selfManager;
    }

    return null;
  }

  private async getFirstUserByRole(
    companyId: string,
    role: 'ADMIN' | 'MANAGER',
    excludeUserId?: string,
  ): Promise<string | null> {
    let query = this.supabaseService.db
      .from('User')
      .select('id')
      .eq('companyId', companyId)
      .eq('role', role)
      .order('createdAt', { ascending: true })
      .limit(1);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to resolve fallback approver');
    }

    if (!data) {
      return null;
    }

    return data.id;
  }

  private async getRuleWithSteps(
    companyId: string,
  ): Promise<(ApprovalRuleRecord & { steps: ApprovalStepRecord[] }) | null> {
    const { data: rule, error: ruleError } = await this.supabaseService.db
      .from('ApprovalRule')
      .select('*')
      .eq('companyId', companyId)
      .order('createdAt', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ruleError && ruleError.code !== 'PGRST116') {
      throw new InternalServerErrorException('Failed to fetch approval rule');
    }

    if (!rule) {
      return null;
    }

    const { data: steps, error: stepsError } = await this.supabaseService.db
      .from('ApprovalStep')
      .select('*')
      .eq('ruleId', rule.id)
      .order('sequence', { ascending: true });

    if (stepsError) {
      throw new InternalServerErrorException('Failed to fetch approval steps');
    }

    return {
      ...(rule as ApprovalRuleRecord),
      steps: (steps ?? []) as ApprovalStepRecord[],
    };
  }

  private async updateExpense(
    expenseId: string,
    patch: Partial<ExpenseRecord>,
  ): Promise<void> {
    const { error } = await this.supabaseService.db
      .from('Expense')
      .update(patch)
      .eq('id', expenseId);

    if (error) {
      throw new InternalServerErrorException('Failed to update expense');
    }
  }

  private toExpenseResponse<T extends ExpenseWithUser>(expense: T) {
    return {
      ...expense,
      amount: Number(expense.amount),
      convertedAmount: Number(expense.convertedAmount),
    };
  }
}
