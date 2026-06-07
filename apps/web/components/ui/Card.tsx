import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="card">
      {title ? <div className="card-title">{title}</div> : null}
      {children}
    </section>
  );
}
