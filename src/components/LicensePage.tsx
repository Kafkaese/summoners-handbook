import { useEffect, useState } from 'react';
import { APP_NAME, COMMUNITY_USE_NOTICE, CONTACT, PAIZO_TRADEMARK_NOTICE } from '../legal';

interface LegalData {
  ogl: string[];
  section15: string[];
}

export function LicensePage({ onClose }: { onClose: () => void }) {
  const [legal, setLegal] = useState<LegalData | null>(null);
  useEffect(() => {
    // The license text is large, so it only loads on this page.
    import('../data/legal.json').then((m) => setLegal(m.default as LegalData));
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="card license">
      <header className="pane-header">
        <button className="back always" onClick={onClose} aria-label="Back to the app">
          ‹
        </button>
        <h2 className="pane-title">License &amp; credits</h2>
      </header>

      <h3>Paizo Community Use</h3>
      <p>{COMMUNITY_USE_NOTICE}</p>
      <p className="fine">{PAIZO_TRADEMARK_NOTICE}</p>

      <h3>Contact</h3>
      <p>
        {CONTACT ? (
          <>
            Questions, corrections or takedown requests:{' '}
            <a href={CONTACT.href} target="_blank" rel="noreferrer">
              {CONTACT.label}
            </a>
          </>
        ) : (
          <em>Contact details still need to be added before publishing.</em>
        )}
      </p>

      <h3>Open Game Content</h3>
      <p>
        The game rules in {APP_NAME} are used under the Open Game License v1.0a (below). The rules text, statistics, stat
        blocks, summon lists, templates and spell data, and the stat blocks the app derives from them by applying
        templates and feats, are Open Game Content as described in Section 1(d) of the license.
      </p>
      <p>
        Product Identity: the name {APP_NAME}, its logo, and the app's design, layout and source code (other than the
        Open Game Content above) are Product Identity as described in Section 1(e). Paizo's trademarks and other Product
        Identity, such as the Pathfinder name, are not Open Game Content; they are used under Paizo's Community Use
        Policy.
      </p>
      <p>
        Rules text and stat blocks were compiled from{' '}
        <a href="https://www.d20pfsrd.com" target="_blank" rel="noreferrer">
          d20pfsrd.com
        </a>{' '}
        and checked against{' '}
        <a href="https://legacy.aonprd.com" target="_blank" rel="noreferrer">
          the Pathfinder Reference Document
        </a>
        .
      </p>

      {legal ? (
        <>
          <h3>Open Game License Version 1.0a</h3>
          <div className="ogl">
            {legal.ogl.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p>
              <strong>15. COPYRIGHT NOTICE</strong>
            </p>
            {legal.section15.map((p, i) => (
              <p key={i} className="notice">
                {p}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="empty">Loading the license…</p>
      )}
    </section>
  );
}
