import Link from "next/link";

import { homepageAssets } from "../../lib/homepage-data";
import { cn } from "../../lib/utils";

interface BrandProps {
  dark?: boolean;
  className?: string;
  href?: string;
}

export function Brand({
  dark = false,
  className,
  href = "/",
}: BrandProps) {
  const textClassName = dark ? "text-white" : "text-slate-950";
  const subtitleClassName = dark ? "text-white/75" : "text-slate-500";

  return (
    <Link className={cn("flex items-center gap-3", className)} href={href}>
      <img
        alt="Chatto mascot logo"
        className="h-14 w-auto sm:h-16"
        src={homepageAssets.logoMascot}
      />
      <div className="min-w-0">
        <div className={cn("font-semibold tracking-[0.2em]", textClassName)}>
          CHATTO
        </div>
        <div className={cn("text-xs", subtitleClassName)}>
          AI Commerce Assistant
        </div>
      </div>
    </Link>
  );
}
