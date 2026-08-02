type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-10 h-10 rounded-xl",
  lg: "w-14 h-14 rounded-2xl",
};

export function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  return (
    <img
      src="/mind-verse-logo.png"
      alt="Mind Verse logo"
      className={`${sizeClass[size]} object-contain shadow-lg shadow-primary-500/20 ${className}`}
    />
  );
}
