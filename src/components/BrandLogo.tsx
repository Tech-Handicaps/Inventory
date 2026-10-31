import Image from "next/image";

type Props = {
  /** Tailwind height class; width follows aspect ratio */
  className?: string;
  priority?: boolean;
  /** White/green artwork for the charcoal sidebar. */
  onDark?: boolean;
};

export function BrandLogo({ className = "h-11 w-auto", priority, onDark }: Props) {
  return (
    <Image
      src={onDark ? "/brand/hna-logo-on-dark.png" : "/brand/hna-logo.png"}
      alt="Handicaps Network Africa"
      width={onDark ? 480 : 220}
      height={onDark ? 184 : 64}
      className={`object-contain object-left ${className}`}
      priority={priority}
    />
  );
}
