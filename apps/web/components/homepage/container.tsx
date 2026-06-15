import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

interface HomepageContainerProps {
  children: ReactNode;
  className?: string;
}

export function HomepageContainer({
  children,
  className,
}: HomepageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
