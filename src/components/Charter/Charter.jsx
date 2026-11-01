import { useRef, useState } from 'react';
import { SECTIONS } from './charterSections';
import styles from './Charter.module.css';

// The initiative's charter lives in the portal. It is a set of headings; the
// Initiative Plan is one of them. The charter only reads: nothing here edits
// the locked plan.
function Charter() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const active = SECTIONS.find((section) => section.id === activeId);
  const { Panel } = active;
  const tabRefs = useRef({});

  // Arrow keys, Home and End move between the headings, as a tab list should.
  function handleKeyDown(event) {
    const index = SECTIONS.findIndex((section) => section.id === activeId);
    const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: SECTIONS.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = SECTIONS[(target + SECTIONS.length) % SECTIONS.length];
    setActiveId(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <section id="charter" className={styles.section} aria-labelledby="charter-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>The Initiative</p>
        <h2 id="charter-title">Charter</h2>
        <div className={styles.layout}>
          <div className={styles.tabs} role="tablist" aria-label="Charter headings" aria-orientation="vertical" onKeyDown={handleKeyDown}>
            {SECTIONS.map((section, index) => (
              <button
                key={section.id}
                id={`charter-tab-${section.id}`}
                ref={(node) => {
                  tabRefs.current[section.id] = node;
                }}
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
