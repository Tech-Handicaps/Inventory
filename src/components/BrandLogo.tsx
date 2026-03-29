import Image from "next/image";

type Props = {
  /** Tailwind height class; width follows aspect ratio */
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "h-11 w-auto", priority }: Props) {
  return (
    <Image
      src="/brand/hna-logo.png"
      alt="Handicaps Network Africa"
      width={220}
      height={64}
      className={`object-contain object-left ${className}`}
      priority={priority}
    />
  );
}
