import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/InfoTip";

type PageHeaderProps = {
  title: string;
  /** One line. Longer guidance goes in `help`. */
  description?: ReactNode;
  help?: ReactNode;
  /** Buttons shown to the right of the title on wide screens. */
  actions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ title, description, help, actions, children }: PageHeaderProps) {
  return (
    <section className="page-hero">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="page-title">{title}</h1>
            {help ? <InfoTip label={`About ${title}`}>{help}</InfoTip> : null}
          </div>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
