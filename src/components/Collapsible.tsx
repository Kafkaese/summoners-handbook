import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** How many options inside are switched on, shown while collapsed. */
  activeCount?: number;
  children: ReactNode;
}

/** A section of settings that folds away; starts collapsed. */
export function Collapsible({ title, activeCount = 0, children }: Props) {
  return (
    <details className="collapsible">
      <summary>
        <span>{title}</span>
        {activeCount > 0 && <span className="count">{activeCount} on</span>}
        <span className="chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="collapsible-body">{children}</div>
    </details>
  );
}
