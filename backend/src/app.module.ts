import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalRulesModule } from './approval-rules/approval-rules.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CurrencyModule } from './currency/currency.module';
import { ExpensesModule } from './expenses/expenses.module';
import { OcrModule } from './ocr/ocr.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ApprovalRulesModule,
    SupabaseModule,
    AuthModule,
    CurrencyModule,
    ExpensesModule,
    OcrModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
