import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, ...props }: InputProps) {
  return (
    <label className="label">
      <span>{label}</span>
      <input className="input" {...props} />
    </label>
  );
}
