"use client";

import type { ChangeEvent, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  isDecimal?: boolean;
  label?: string;
  error?: string;
};

export function CurrencyInput({
  value,
  onChange,
  isDecimal = true,
  label,
  error,
  placeholder,
  onFocus,
  ...rest
}: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.currentTarget.value;

    // Convert comma to period for decimal numbers
    if (isDecimal) {
      inputValue = inputValue.replace(",", ".");
    }

    // Allow only numbers and decimal point for decimal inputs
    if (isDecimal) {
      inputValue = inputValue.replace(/[^\d.]/g, "");
      // Prevent multiple decimal points
      if ((inputValue.match(/\./g) || []).length > 1) {
        inputValue = inputValue.slice(0, -1);
      }
    } else {
      // Allow only numbers for integer inputs
      inputValue = inputValue.replace(/\D/g, "");
    }

    onChange(inputValue);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Clear placeholder value if input is empty and has placeholder
    if (!value && placeholder) {
      e.currentTarget.value = "";
    }
    onFocus?.(e);
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-hetu-text mb-2">
          {label}
        </label>
      )}
      <input
        type="text"
        inputMode={isDecimal ? "decimal" : "numeric"}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder || (isDecimal ? "0.00" : "0")}
        className={`w-full px-3 py-2 border rounded-lg bg-white text-hetu-text placeholder:text-hetu-text/40 focus:outline-none focus:ring-2 focus:ring-hetu-gold focus-visible:ring-offset-0 transition ${
          error ? "border-red-300 focus:ring-red-500" : "border-hetu-green/20"
        }`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
