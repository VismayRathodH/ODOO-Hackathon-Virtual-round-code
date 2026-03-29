import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrencyService } from './currency.service';

@Controller('currency')
@UseGuards(JwtAuthGuard)
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  getRates(@Query('base') base = 'USD') {
    return this.currencyService.getRates(base);
  }

  @Get('countries')
  getCountries() {
    return this.currencyService.getCountries();
  }
}