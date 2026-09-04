import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import type { HouseholdCurrency } from "../api/types";

const LOCALE_BY_CURRENCY: Record<HouseholdCurrency, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  GBP: "en-GB",
  CHF: "de-CH",
  CAD: "en-CA",
};

export function useCurrencyFormatter(options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const { household } = useAuth();
  const currencyCode = household?.currency ?? "EUR";
  return useMemo(
    () => new Intl.NumberFormat(LOCALE_BY_CURRENCY[currencyCode], { style: "currency", currency: currencyCode, ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currencyCode],
  );
}
