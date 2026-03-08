import { type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  success?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, success, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]"
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[length:var(--type-caption)] text-[var(--status-danger)]">{error}</p>
      )}
      {success && (
        <p className="text-[length:var(--type-caption)] text-[var(--status-success)]">{success}</p>
      )}
    </div>
  );
}
