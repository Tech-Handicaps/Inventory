import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/InfoTip";

type PageHeaderProps = {
  title: string;
  /** One line. Longer guidance goes in `help`. */
  description?: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ title, description, help, children }: PageHeaderProps) {
  return (
    <section className="page-hero">
      <div className="flex items-center gap-1.5">
        <h1 className="page-title">{title}</h1>
        {help ? <InfoTip label={`About ${title}`}>{help}</InfoTip> : null}
      </div>
      {description ? <p className="page-description">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
