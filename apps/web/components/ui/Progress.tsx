import { cn } from "../../lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
}

const widthClassMap: Record<number, string> = {
  0: "w-0",
  2: "w-[2%]",
  3: "w-[3%]",
  5: "w-[5%]",
  15: "w-[15%]",
  68: "w-[68%]",
  72: "w-[72%]",
  78: "w-[78%]",
  84: "w-[84%]",
  96: "w-[96%]",
  98: "w-[98%]",
  100: "w-full",
};

export function Progress({
  value,
  className,
  indicatorClassName,
}: ProgressProps) {
  const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));
  const widthClass = widthClassMap[normalizedValue] ?? "w-0";

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
      role="progressbar"
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-all",
          widthClass,
          indicatorClassName,
        )}
      />
    </div>
  );
}
