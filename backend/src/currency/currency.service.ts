import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type RatesCacheEntry = {
  fetchedAt: number;
  rates: Record<string, number>;
};

type CountryCurrency = {
  name: string;
  code: string;
  currency: string;
};

@Injectable()
export class CurrencyService {
  private readonly ratesCache = new Map<string, RatesCacheEntry>();
  private readonly ratesTtlMs = 10 * 60 * 1000;
  private countriesCache: CountryCurrency[] | null = null;

  async getRates(base: string) {
    const normalizedBase = base.toUpperCase();
    const now = Date.now();
    const cached = this.ratesCache.get(normalizedBase);

    if (cached && now - cached.fetchedAt < this.ratesTtlMs) {
      return { base: normalizedBase, rates: cached.rates, cached: true };
    }

    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${normalizedBase}`,
    );

    if (!response.ok) {
      throw new ServiceUnavailableException('Unable to fetch currency rates');
    }

    const data = (await response.json()) as {
      rates?: Record<string, number>;
    };

    if (!data.rates) {
      throw new ServiceUnavailableException('Currency rates response is invalid');
    }

    this.ratesCache.set(normalizedBase, {
      fetchedAt: now,
      rates: data.rates,
    });

    return { base: normalizedBase, rates: data.rates, cached: false };
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    const normalizedFrom = from.toUpperCase();
    const normalizedTo = to.toUpperCase();

    if (normalizedFrom === normalizedTo) {
      return amount;
    }

    const ratesData = await this.getRates(normalizedFrom);
    const rate = ratesData.rates[normalizedTo];

    if (!rate) {
      throw new BadRequestException(
        `No conversion rate from ${normalizedFrom} to ${normalizedTo}`,
      );
    }

    return amount * rate;
  }

  async getCountries(): Promise<CountryCurrency[]> {
    if (this.countriesCache) {
      return this.countriesCache;
    }

    const response = await fetch(
      'https://restcountries.com/v3.1/all?fields=name,currencies,cca2',
    );

    if (!response.ok) {
      throw new ServiceUnavailableException('Unable to fetch country metadata');
    }

    const countries = (await response.json()) as Array<{
      name?: { common?: string };
      currencies?: Record<string, { name?: string }>;
      cca2?: string;
    }>;

    const parsed = countries
      .map((country) => {
        const currencyCode = country.currencies
          ? Object.keys(country.currencies)[0]
          : undefined;

        if (!country.name?.common || !country.cca2 || !currencyCode) {
          return null;
        }

        return {
          name: country.name.common,
          code: country.cca2,
          currency: currencyCode,
        } satisfies CountryCurrency;
      })
      .filter((item): item is CountryCurrency => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    this.countriesCache = parsed;
    return parsed;
  }
}