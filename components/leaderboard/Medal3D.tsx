"use client";

const colors = {
  gold: { outer: "#fcd34d", inner: "#b45309" },
  silver: { outer: "#cbd5e1", inner: "#475569" },
  bronze: { outer: "#fdba74", inner: "#9a3412" },
};

/** Decorative, static medal. The surrounding rank supplies its accessible label. */
export default function Medal3D({ variant = "gold", size = 28 }: { variant?: "gold" | "silver" | "bronze"; size?: number }) {
  const color = colors[variant];
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="m9 20-2 10 9-4 9 4-2-10" fill={color.inner} />
    <circle cx="16" cy="13" r="11" fill={color.outer} />
    <circle cx="16" cy="13" r="8" stroke={color.inner} strokeWidth="1.5" />
    <path d="m16 6 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L9.2 11l4.7-.7L16 6Z" fill={color.inner} />
  </svg>;
}
