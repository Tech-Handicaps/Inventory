import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  eyebrow = "Handicaps Network Africa",
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <section className="page-hero">
      <div className="page-hero-blob page-hero-blob-a" aria-hidden />
      <div className="page-hero-blob page-hero-blob-b" aria-hidden />
      <div className="relative">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title brand-gradient-text">{title}</h1>
        {description ? (
          <div className="page-description">{description}</div>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}
