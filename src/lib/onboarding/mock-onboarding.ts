import {
  isBusinessType,
  isCountryCode,
  type BusinessType,
  type CountryCode,
} from "@/lib/domain/business-options";
import { isCurrencyCode, type CurrencyCode } from "@/lib/domain/currencies";
import { saveMockWorkspace } from "@/lib/onboarding/mock-workspace";

export interface BusinessDetailsInput {
  baseCurrency: CurrencyCode;
  businessName: string;
  businessType?: BusinessType;
  country?: CountryCode;
  secondaryCurrency?: CurrencyCode;
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 650));

export async function saveBusinessDetails(input: BusinessDetailsInput) {
  await pause();

  if (
    input.businessName.trim().length < 2 ||
    !isCurrencyCode(input.baseCurrency) ||
    (input.secondaryCurrency !== undefined &&
      !isCurrencyCode(input.secondaryCurrency)) ||
    input.secondaryCurrency === input.baseCurrency ||
    (input.businessType !== undefined && !isBusinessType(input.businessType)) ||
    (input.country !== undefined && !isCountryCode(input.country))
  ) {
    throw new Error("Invalid business details");
  }

  if (input.businessName.trim().toLowerCase() === "error test") {
    throw new Error("Simulated onboarding failure");
  }

  saveMockWorkspace({
    ...input,
    businessName: input.businessName.trim(),
  });
}
