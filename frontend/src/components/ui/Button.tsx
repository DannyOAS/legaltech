import { ButtonHTMLAttributes, forwardRef } from "react";
import Spinner from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-500 focus-visible:outline-primary-600 disabled:bg-primary-300",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:border-primary-400 hover:text-primary-600 disabled:border-slate-200 disabled:text-slate-400",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-300",
  ghost:
    "text-slate-600 hover:text-primary-600 hover:bg-primary-50 disabled:text-slate-400",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", isLoading = false, leftIcon, rightIcon, children, className, disabled, ...rest },
    ref,
  ) => {
    const classes = [
      "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
      variantStyles[variant],
      sizeStyles[size],
      disabled || isLoading ? "cursor-not-allowed opacity-80" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={classes} disabled={disabled || isLoading} {...rest}>
        {isLoading ? <Spinner /> : leftIcon}
        {children}
        {rightIcon && !isLoading ? rightIcon : null}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
