import React, { useState } from "react";
import { CalendarDays, Coins, Plus, Tag } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { Constants } from "@/db/database.types";
import { BILLING_CYCLE_LABELS, SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { RENEWAL_DATE_MAX, RENEWAL_DATE_MIN } from "@/lib/services/dates";
import type { BillingCycle } from "@/types";

// Mirrors the server-side rules in `src/lib/validation/subscription.ts` without importing zod into the client bundle.
const MAX_NAME_LENGTH = 100;
const PRICE_PATTERN = /^\d{1,8}([.,]\d{1,2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const selectBase =
  "w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors";

function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

interface Props {
  serverError?: string | null;
}

type Field = "name" | "price" | "next_renewal_date";

export default function AddSubscriptionForm({ serverError }: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>("PLN");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [nextRenewalDate, setNextRenewalDate] = useState("");
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
    <form method="POST" action="/api/subscriptions" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
          <label htmlFor="currency" className="mb-1 block text-sm text-blue-100/80">
            Currency
          </label>
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
              <option key={code} value={code} className="bg-slate-900">
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="billing_cycle" className="mb-1 block text-sm text-blue-100/80">
          Billing cycle
        </label>
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
            <option key={cycle} value={cycle} className="bg-slate-900">
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

      <SubmitButton pendingText="Saving..." icon={<Plus className="size-4" />}>
        Add subscription
      </SubmitButton>
    </form>
  );
}
