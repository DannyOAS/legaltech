interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-4",
};

export const Spinner = ({ size = "sm", className }: SpinnerProps) => {
  const classes = [
    "inline-block",
    "animate-spin",
    "rounded-full",
    "border-slate-300",
    "border-t-primary-500",
    sizeMap[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} role="status" aria-label="Loading" />;
};

export default Spinner;
