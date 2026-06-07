import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary" ? "button-primary" : "button-secondary";

  return (
    <button
      className={`button ${variantClass}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
