interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className = "" }: SkeletonProps) => {
  const classes = [
    "animate-pulse",
    "rounded-md",
    "bg-slate-200/70",
    "dark:bg-slate-700/60",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} aria-hidden="true" />;
};

export default Skeleton;
