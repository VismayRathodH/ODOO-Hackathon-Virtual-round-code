import { apiClient } from "./client";

type CountryCurrency = {
  name: string;
  code: string;
  currency: string;
};

type RatesResponse = {
  base: string;
  rates: Record<string, number>;
};

export const currenciesApi = {
  getCurrencies: async () => {
    const countries = await apiClient<CountryCurrency[]>("/currency/countries");
    const formatter = new Intl.DisplayNames(["en"], { type: "currency" });
    const byCurrency = new Map<string, { code: string; name: string; symbol: string }>();

    countries.forEach((country) => {
      const currencyCode = country.currency.toUpperCase();
      if (!byCurrency.has(currencyCode)) {
        byCurrency.set(currencyCode, {
          code: currencyCode,
          name: formatter.of(currencyCode) || currencyCode,
          symbol: currencyCode,
        });
      }
    });

    return Array.from(byCurrency.values()).sort((a, b) => a.code.localeCompare(b.code));
  },

  getFxRate: async (from: string, to: string, amount: number) => {
    const normalizedFrom = from.toUpperCase();
    const normalizedTo = to.toUpperCase();

    if (normalizedFrom === normalizedTo) {
      return { convertedAmount: amount, rate: 1 };
    }

    const rates = await apiClient<RatesResponse>(
      `/currency/rates?base=${encodeURIComponent(normalizedFrom)}`
    );

    const rate = rates.rates?.[normalizedTo];
    if (!rate) {
      throw new Error(`Missing FX rate from ${normalizedFrom} to ${normalizedTo}`);
    }

    return {
      convertedAmount: amount * rate,
      rate,
    };
  },
};
