import { InputHTMLAttributes, forwardRef } from "react";

export interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, description, error, className, id, ...rest }, ref) => {
    const fieldId = id ?? rest.name ?? label.replace(/\s+/g, "-").toLowerCase();
    return (
      <div className={["flex items-start gap-3", className].filter(Boolean).join(" ")}>
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          aria-invalid={Boolean(error)}
          {...rest}
        />
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    );
  },
);

CheckboxField.displayName = "CheckboxField";

export default CheckboxField;
