import { Module } from '@nestjs/common';
import { CurrencyModule } from '../currency/currency.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [CurrencyModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}