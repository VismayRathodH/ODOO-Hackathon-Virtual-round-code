import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CurrencyService } from './../src/currency/currency.service';
import { SupabaseService } from './../src/supabase/supabase.service';

type QueryResult<T = unknown> = {
  data: T;
  error: { message: string; code?: string } | null;
  count?: number;
};

type QueryMode = 'default' | 'single' | 'maybeSingle';

class FakeCurrencyService {
  async convert(amount: number, from: string, to: string): Promise<number> {
    return from.toUpperCase() === to.toUpperCase() ? amount : amount * 1.1;
  }

  async getRates(base: string) {
    return {
      base: base.toUpperCase(),
      rates: {
        USD: 1,
        EUR: 0.9,
      },
      cached: false,
    };
  }

  async getCountries() {
    return [{ name: 'United States', code: 'US', currency: 'USD' }];
  }
}

class FakeSupabaseClient {
  private readonly tables: Record<string, Array<Record<string, unknown>>> = {
    Company: [],
    User: [],
    Expense: [],
    ApprovalRule: [],
    ApprovalStep: [],
    ApprovalLog: [],
  };

  from(table: string): FakeQueryBuilder {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }

    return new FakeQueryBuilder(this, table);
  }

  getRows(table: string): Array<Record<string, unknown>> {
    return this.tables[table] ?? [];
  }

  insertRows(
    table: string,
    payloads: Array<Record<string, unknown>>,
  ): QueryResult<Array<Record<string, unknown>>> {
    if (table === 'User') {
      for (const payload of payloads) {
        const email = String(payload.email ?? '').toLowerCase();
        const duplicate = this.tables.User.some(
          (row) => String(row.email ?? '').toLowerCase() === email,
        );

        if (duplicate) {
          return {
            data: [],
            error: { code: '23505', message: 'duplicate key value' },
          };
        }
      }
    }

    const inserted = payloads.map((payload) => this.createRow(table, payload));
    this.tables[table].push(...inserted);

    return { data: inserted, error: null };
  }

  updateRows(
    table: string,
    filter: (row: Record<string, unknown>) => boolean,
    patch: Record<string, unknown>,
  ): QueryResult<Array<Record<string, unknown>>> {
    const now = new Date().toISOString();
    const updated: Array<Record<string, unknown>> = [];

    this.tables[table] = this.tables[table].map((row) => {
      if (!filter(row)) {
        return row;
      }

      const next = { ...row, ...patch };
      if (table === 'User') {
        next.updatedAt = now;
      }
      if (table === 'Expense') {
        next.updatedAt = now;
      }

      updated.push(next);
      return next;
    });

    return { data: updated, error: null };
  }

  deleteRows(
    table: string,
    filter: (row: Record<string, unknown>) => boolean,
  ): QueryResult<Array<Record<string, unknown>>> {
    const removed: Array<Record<string, unknown>> = [];
    this.tables[table] = this.tables[table].filter((row) => {
      if (filter(row)) {
        removed.push(row);
        return false;
      }

      return true;
    });

    return { data: removed, error: null };
  }

  private createRow(
    table: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const now = new Date().toISOString();

    if (table === 'Company') {
      return {
        id: randomUUID(),
        name: null,
        currency: 'USD',
        country: null,
        createdAt: now,
        ...payload,
      };
    }

    if (table === 'User') {
      return {
        id: randomUUID(),
        email: '',
        passwordHash: '',
        name: null,
        role: 'EMPLOYEE',
        companyId: null,
        managerId: null,
        createdAt: now,
        updatedAt: now,
        ...payload,
      };
    }

    if (table === 'Expense') {
      return {
        id: randomUUID(),
        userId: null,
        amount: 0,
        currency: 'USD',
        convertedAmount: 0,
        companyCurrency: 'USD',
        category: 'Other',
        description: '',
        date: now,
        receiptUrl: null,
        status: 'PENDING',
        currentStep: 0,
        currentApproverId: null,
        createdAt: now,
        updatedAt: now,
        ...payload,
      };
    }

    if (table === 'ApprovalRule') {
      return {
        id: randomUUID(),
        companyId: null,
        name: '',
        type: 'SEQUENTIAL',
        percentageThreshold: null,
        specificApproverId: null,
        createdAt: now,
        ...payload,
      };
    }

    if (table === 'ApprovalStep') {
      return {
        id: randomUUID(),
        ruleId: null,
        approverId: null,
        sequence: 0,
        isManagerApprover: false,
        ...payload,
      };
    }

    if (table === 'ApprovalLog') {
      return {
        id: randomUUID(),
        expenseId: null,
        approverId: null,
        action: null,
        comment: null,
        stepSequence: 0,
        timestamp: now,
        ...payload,
      };
    }

    return { id: randomUUID(), ...payload };
  }
}

class FakeQueryBuilder implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selectColumns = '*';
  private selectOptions: Record<string, unknown> | undefined;
  private insertPayload: Array<Record<string, unknown>> = [];
  private updatePayload: Record<string, unknown> = {};
  private readonly filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private sortBy: { field: string; ascending: boolean } | null = null;
  private limitSize: number | null = null;

  constructor(
    private readonly client: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(columns = '*', options?: Record<string, unknown>): this {
    this.selectColumns = columns;
    this.selectOptions = options;
    return this;
  }

  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>): this {
    this.operation = 'insert';
    this.insertPayload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.operation = 'update';
    this.updatePayload = patch;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: string, values: Array<unknown>): this {
    const allowed = new Set(values);
    this.filters.push((row) => allowed.has(row[field]));
    return this;
  }

  ilike(field: string, pattern: string): this {
    const regex = new RegExp(
      `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`,
      'i',
    );
    this.filters.push((row) => regex.test(String(row[field] ?? '')));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.sortBy = { field, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.limitSize = count;
    return this;
  }

  async single(): Promise<QueryResult<Record<string, unknown> | null>> {
    return this.run('single');
  }

  async maybeSingle(): Promise<QueryResult<Record<string, unknown> | null>> {
    return this.run('maybeSingle');
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run('default').then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async run(mode: QueryMode): Promise<QueryResult> {
    if (this.operation === 'insert') {
      return this.runInsert(mode);
    }

    if (this.operation === 'update') {
      return this.runUpdate(mode);
    }

    if (this.operation === 'delete') {
      return this.runDelete(mode);
    }

    return this.runSelect(mode);
  }

  private runSelect(mode: QueryMode): QueryResult {
    const filtered = this.applyFilters(this.client.getRows(this.table));
    const count = filtered.length;
    const sorted = this.applySort(filtered);
    const limited = this.applyLimit(sorted);
    const projected = this.projectRows(limited);

    if (this.selectOptions?.count === 'exact') {
      return {
        data: this.selectOptions?.head ? null : projected,
        count,
        error: null,
      };
    }

    if (mode === 'single') {
      if (projected.length === 0) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        };
      }

      return { data: projected[0], error: null };
    }

    if (mode === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null };
    }

    return { data: projected, error: null };
  }

  private runInsert(mode: QueryMode): QueryResult {
    const result = this.client.insertRows(this.table, this.insertPayload);
    if (result.error) {
      return { data: null, error: result.error };
    }

    const projected = this.projectRows(result.data);

    if (mode === 'single') {
      return { data: projected[0] ?? null, error: projected[0] ? null : { message: 'No rows inserted' } };
    }

    if (mode === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null };
    }

    return {
      data: this.selectColumns === '*' || this.selectColumns.length > 0 ? projected : null,
      error: null,
    };
  }

  private runUpdate(mode: QueryMode): QueryResult {
    const result = this.client.updateRows(
      this.table,
      (row) => this.matches(row),
      this.updatePayload,
    );
    if (result.error) {
      return { data: null, error: result.error };
    }

    const projected = this.projectRows(result.data);

    if (mode === 'single') {
      if (projected.length === 0) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        };
      }
      return { data: projected[0], error: null };
    }

    if (mode === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null };
    }

    return {
      data: this.selectColumns === '*' || this.selectColumns.length > 0 ? projected : null,
      error: null,
    };
  }

  private runDelete(mode: QueryMode): QueryResult {
    const result = this.client.deleteRows(this.table, (row) => this.matches(row));
    if (result.error) {
      return { data: null, error: result.error };
    }

    const projected = this.projectRows(result.data);

    if (mode === 'single') {
      return { data: projected[0] ?? null, error: projected[0] ? null : { message: 'No rows deleted' } };
    }

    if (mode === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null };
    }

    return {
      data: this.selectColumns === '*' || this.selectColumns.length > 0 ? projected : null,
      error: null,
    };
  }

  private applyFilters(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.filter((row) => this.matches(row));
  }

  private matches(row: Record<string, unknown>): boolean {
    return this.filters.every((predicate) => predicate(row));
  }

  private applySort(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    if (!this.sortBy) {
      return [...rows];
    }

    const { field, ascending } = this.sortBy;
    return [...rows].sort((a, b) => {
      const left = a[field];
      const right = b[field];

      if (left === right) {
        return 0;
      }
      if (left === undefined || left === null) {
        return ascending ? 1 : -1;
      }
      if (right === undefined || right === null) {
        return ascending ? -1 : 1;
      }

      if (left < right) {
        return ascending ? -1 : 1;
      }

      return ascending ? 1 : -1;
    });
  }

  private applyLimit(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    if (this.limitSize === null) {
      return rows;
    }

    return rows.slice(0, this.limitSize);
  }

  private projectRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const columns = this.parseColumns();
    if (!columns) {
      return rows.map((row) => ({ ...row }));
    }

    return rows.map((row) => {
      const projected: Record<string, unknown> = {};
      columns.forEach((column) => {
        projected[column] = row[column];
      });
      return projected;
    });
  }

  private parseColumns(): string[] | null {
    const raw = this.selectColumns.trim();
    if (!raw || raw === '*') {
      return null;
    }

    return raw
      .split(',')
      .map((column) => column.trim())
      .filter((column) => column.length > 0);
  }
}

class FakeSupabaseService {
  public readonly db = new FakeSupabaseClient();
}

describe('Main Flows (e2e)', () => {
  let app: INestApplication<App>;
  let fakeSupabaseService: FakeSupabaseService;

  beforeEach(async () => {
    fakeSupabaseService = new FakeSupabaseService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(fakeSupabaseService)
      .overrideProvider(CurrencyService)
      .useValue(new FakeCurrencyService())
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('register/login flow works and users route is role-protected', async () => {
    const registerAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@acme.com',
        password: 'demo123',
        name: 'Admin',
      })
      .expect(201);

    expect(registerAdmin.body.user.role).toBe('ADMIN');
    expect(registerAdmin.body.access_token).toBeDefined();

    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@acme.com',
        password: 'demo123',
      })
      .expect(201);

    const adminToken = loginAdmin.body.access_token as string;

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Employee',
        email: 'employee@acme.com',
        password: 'demo123',
        role: 'EMPLOYEE',
      })
      .expect(201);

    const loginEmployee = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'employee@acme.com',
        password: 'demo123',
      })
      .expect(201);

    const employeeToken = loginEmployee.body.access_token as string;

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    const usersList = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(usersList.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'admin@acme.com', role: 'ADMIN' }),
        expect.objectContaining({ email: 'employee@acme.com', role: 'EMPLOYEE' }),
      ]),
    );
  });

  it('supports submit, approve, reject flows and role guards', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@acme.com',
        password: 'demo123',
        name: 'Admin',
      })
      .expect(201);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@acme.com',
        password: 'demo123',
      })
      .expect(201);

    const adminToken = adminLogin.body.access_token as string;

    const managerCreate = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Manager',
        email: 'manager@acme.com',
        password: 'demo123',
        role: 'MANAGER',
      })
      .expect(201);

    const employeeCreate = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Employee',
        email: 'employee@acme.com',
        password: 'demo123',
        role: 'EMPLOYEE',
      })
      .expect(201);

    const managerId = managerCreate.body.id as string;

    const managerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'manager@acme.com',
        password: 'demo123',
      })
      .expect(201);

    const employeeLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'employee@acme.com',
        password: 'demo123',
      })
      .expect(201);

    const managerToken = managerLogin.body.access_token as string;
    const employeeToken = employeeLogin.body.access_token as string;

    const rulePayload = {
      name: 'Single-step manager approval',
      type: 'SEQUENTIAL',
      steps: [
        {
          approverId: managerId,
          sequence: 0,
          isManagerApprover: false,
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/approval-rules')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(rulePayload)
      .expect(403);

    const createRule = await request(app.getHttpServer())
      .post('/approval-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(rulePayload)
      .expect(201);

    expect(createRule.body.steps).toHaveLength(1);

    const expenseOne = await request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        amount: 100,
        currency: 'USD',
        category: 'Travel',
        description: 'Travel expense for client meeting',
        date: '2026-03-01',
      })
      .expect(201);

    expect(expenseOne.body.status).toBe('PENDING');
    expect(expenseOne.body.currentApproverId).toBe(managerId);

    await request(app.getHttpServer())
      .post(`/expenses/${expenseOne.body.id}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);

    const approveOne = await request(app.getHttpServer())
      .post(`/expenses/${expenseOne.body.id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);

    expect(approveOne.body.status).toBe('APPROVED');

    const expenseTwo = await request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        amount: 250,
        currency: 'USD',
        category: 'Food',
        description: 'Team dinner with project stakeholders',
        date: '2026-03-02',
      })
      .expect(201);

    const rejectTwo = await request(app.getHttpServer())
      .post(`/expenses/${expenseTwo.body.id}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Policy limit exceeded for this category' })
      .expect(201);

    expect(rejectTwo.body.status).toBe('REJECTED');

    const employeeExpenses = await request(app.getHttpServer())
      .get('/expenses')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(employeeExpenses.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expenseOne.body.id, status: 'APPROVED' }),
        expect.objectContaining({ id: expenseTwo.body.id, status: 'REJECTED' }),
      ]),
    );

    expect(employeeCreate.body.email).toBe('employee@acme.com');
  });
});
