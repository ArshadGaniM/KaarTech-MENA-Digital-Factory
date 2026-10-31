import { useState } from 'react';
import { SECTIONS } from './charterSections';
import styles from './Charter.module.css';

// The initiative's charter lives in the portal. It is a set of headings; the
// Initiative Plan is one of them. The charter only reads: nothing here edits
// the locked plan.
function Charter() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const active = SECTIONS.find((section) => section.id === activeId);
  const { Panel } = active;

  return (
    <section id="charter" className={styles.section} aria-labelledby="charter-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>The Initiative</p>
        <h2 id="charter-title">Charter</h2>
        <div className={styles.layout}>
          <div className={styles.tabs} role="tablist" aria-label="Charter headings" aria-orientation="vertical">
            {SECTIONS.map((section, index) => (
              <button
                key={section.id}
                id={`charter-tab-${section.id}`}
                type="button"
                role="tab"
                aria-selected={section.id === activeId}
                aria-controls="charter-panel"
                tabIndex={section.id === activeId ? 0 : -1}
                className={styles.tab}
                onClick={() => setActiveId(section.id)}
              >
                <span className={styles.number}>{index + 1}</span>
                {section.title}
              </button>
            ))}
          </div>
          <div id="charter-panel" role="tabpanel" aria-labelledby={`charter-tab-${active.id}`} className={styles.panel}>
            <h3>{active.title}</h3>
            <Panel />
          </div>
        </div>
      </div>
    </section>
  );
}

export default Charter;
