import { InputHTMLAttributes, forwardRef } from "react";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, description, error, required, className, id, ...rest }, ref) => {
    const fieldId = id ?? rest.name;
    const describedBy = description ? `${fieldId}-description` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const inputClasses = [
      "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm",
      "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
      error ? "border-red-400 focus:border-red-500 focus:ring-red-200" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <label className="block text-sm">
        <span className="font-medium text-slate-700">
          {label}
          {required ? <span className="text-red-500">*</span> : null}
        </span>
        <input ref={ref} id={fieldId} aria-describedby={error ? errorId : describedBy} aria-invalid={Boolean(error)} className={inputClasses} required={required} {...rest} />
        {description ? (
          <span id={describedBy} className="mt-1 block text-xs text-slate-500">
            {description}
          </span>
        ) : null}
        {error ? (
          <span id={errorId} className="mt-1 block text-xs text-red-600">
            {error}
          </span>
        ) : null}
      </label>
    );
  },
);

TextField.displayName = "TextField";

export default TextField;
