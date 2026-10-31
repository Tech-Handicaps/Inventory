import Image from "next/image";
import { BRAND_LOGO_ON_DARK_DATA_URI } from "@/components/brand-logo-on-dark-data";

type Props = {
  /** Tailwind height class; width follows aspect ratio */
  className?: string;
  priority?: boolean;
  /** White/green artwork for the charcoal sidebar. */
  onDark?: boolean;
};

export function BrandLogo({ className = "h-11 w-auto", priority, onDark }: Props) {
  if (onDark) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- inlined data URI must paint with the shell, no image request
      <img
        src={BRAND_LOGO_ON_DARK_DATA_URI}
        alt="Handicaps Network Africa"
        width={320}
        height={123}
        decoding="sync"
        className={`object-contain object-left ${className}`}
      />
    );
  }
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
