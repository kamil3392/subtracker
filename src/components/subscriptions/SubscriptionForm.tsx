import React, { useState } from "react";
import { CalendarDays, Coins, Plus, Save, Tag } from "lucide-react";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ServerError } from "@/components/form/ServerError";
import { Label } from "@/components/ui/label";
import { Constants } from "@/db/database.types";
import { BILLING_CYCLE_LABELS, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/currencies";
import { RENEWAL_DATE_MAX, RENEWAL_DATE_MIN } from "@/lib/services/dates";
import type { BillingCycle, SubscriptionFormValues } from "@/types";

// Mirrors the server-side rules in `src/lib/validation/subscription.ts` without importing zod into the client bundle.
const MAX_NAME_LENGTH = 100;
const PRICE_PATTERN = /^\d{1,8}([.,]\d{1,2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Native select on the same tokens as `ui/input.tsx` (border, background, focus ring).
const selectBase =
  "border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-3 md:text-sm";

function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const DEFAULT_CURRENCY: SupportedCurrency = "PLN";
const DEFAULT_BILLING_CYCLE: BillingCycle = "monthly";

function isSupportedCurrency(value: string | undefined): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly (string | undefined)[]).includes(value);
}

function isBillingCycle(value: string | undefined): value is BillingCycle {
  return (Constants.public.Enums.billing_cycle as readonly (string | undefined)[]).includes(value);
}

// Serializable icon keys: an `.astro` page cannot pass a React element into a `client:load` island.
const SUBMIT_ICONS = {
  plus: Plus,
  save: Save,
} as const;

interface Props {
  action: string;
  submitLabel: string;
  pendingText: string;
  submitIcon?: keyof typeof SUBMIT_ICONS;
  initialValues?: Partial<SubscriptionFormValues>;
  serverError?: string | null;
}

type Field = "name" | "price" | "next_renewal_date";

export default function SubscriptionForm({
  action,
  submitLabel,
  pendingText,
  submitIcon = "plus",
  initialValues,
  serverError,
}: Props) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [price, setPrice] = useState(initialValues?.price ?? "");
  // A select cannot show a value outside its options, so unknown carried values fall back to the defaults.
  const [currency, setCurrency] = useState<string>(
    isSupportedCurrency(initialValues?.currency) ? initialValues.currency : DEFAULT_CURRENCY,
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    isBillingCycle(initialValues?.billing_cycle) ? initialValues.billing_cycle : DEFAULT_BILLING_CYCLE,
  );
  const [nextRenewalDate, setNextRenewalDate] = useState(initialValues?.next_renewal_date ?? "");
  const SubmitIcon = SUBMIT_ICONS[submitIcon];
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  function validate() {
    const next: typeof errors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      next.name = "Name is required";
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      next.name = `Name must be at most ${MAX_NAME_LENGTH} characters`;
    }

    const trimmedPrice = price.trim();
    if (!trimmedPrice) {
      next.price = "Price is required";
    } else if (!PRICE_PATTERN.test(trimmedPrice)) {
      next.price = "Price must be a number with at most 8 digits and 2 decimal places";
    } else if (Number(trimmedPrice.replace(",", ".")) <= 0) {
      next.price = "Price must be greater than 0";
    }

    if (!nextRenewalDate) {
      next.next_renewal_date = "Next renewal date is required";
    } else if (!isCalendarDate(nextRenewalDate)) {
      next.next_renewal_date = "Next renewal date must be a valid date (YYYY-MM-DD)";
    } else if (nextRenewalDate < RENEWAL_DATE_MIN || nextRenewalDate > RENEWAL_DATE_MAX) {
      next.next_renewal_date = `Next renewal date must be between ${RENEWAL_DATE_MIN} and ${RENEWAL_DATE_MAX}`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: Field) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action={action} className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="name"
        label="Name"
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="e.g. Netflix"
        error={errors.name}
        icon={<Tag className="size-4" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <FormField
          id="price"
          label="Price"
          inputMode="decimal"
          value={price}
          onChange={(v) => {
            setPrice(v);
            clearError("price");
          }}
          placeholder="49.99"
          error={errors.price}
          icon={<Coins className="size-4" />}
        />

        <div>
          <Label htmlFor="currency" className="mb-1.5">
            Currency
          </Label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
            }}
            className={selectBase}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="billing_cycle" className="mb-1.5">
          Billing cycle
        </Label>
        <select
          id="billing_cycle"
          name="billing_cycle"
          value={billingCycle}
          onChange={(e) => {
            setBillingCycle(e.target.value as BillingCycle);
          }}
          className={selectBase}
        >
          {Constants.public.Enums.billing_cycle.map((cycle) => (
            <option key={cycle} value={cycle}>
              {BILLING_CYCLE_LABELS[cycle]}
            </option>
          ))}
        </select>
      </div>

      <FormField
        id="next_renewal_date"
        label="Next renewal date"
        type="date"
        value={nextRenewalDate}
        onChange={(v) => {
          setNextRenewalDate(v);
          clearError("next_renewal_date");
        }}
        error={errors.next_renewal_date}
        icon={<CalendarDays className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={pendingText} icon={<SubmitIcon className="size-4" />}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
