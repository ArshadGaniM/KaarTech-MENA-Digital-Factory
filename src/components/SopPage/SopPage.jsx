import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useServices } from '../../hooks/useServices';
import { SOP_CONTENT, SOP_SECTIONS } from '../../data/sop';
import styles from './SopPage.module.css';

// The SOP screen for one service. Every service shows the same headings. A
// heading with no text yet says so instead of leaving a gap.
function SopPage({ code }) {
  const { data: services, isLoading, error, retry } = useServices();
  const service = services?.find((entry) => entry.code === code);
  const content = SOP_CONTENT[code] ?? {};

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [code]);

  return (
    <section className={styles.page} aria-labelledby="sop-title">
      <div className={styles.inner}>
        <a href="#services" className={styles.back}>
          <span aria-hidden="true">&larr;</span> Back to services
        </a>
        {isLoading && <p role="status">Loading the SOP.</p>}
        {error && !isLoading && (
          <div role="alert">
            <p>The SOP could not be loaded.</p>
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {!isLoading && !error && !service && (
          <div role="alert">
            <h1 id="sop-title">Service not found</h1>
            <p>No service is listed under this link. It may have been removed.</p>
          </div>
        )}
        {service && (
          <>
            <p className={styles.eyebrow}>Standard Operating Procedure</p>
            <h1 id="sop-title">{service.title}</h1>
            {service.description && <p className={styles.summary}>{service.description}</p>}
            <div className={styles.sections}>
              {SOP_SECTIONS.map((section) => (
                <section key={section.id} className={styles.section} aria-labelledby={`sop-${section.id}`}>
                  <h2 id={`sop-${section.id}`}>{section.title}</h2>
                  {content[section.id] ? <p>{content[section.id]}</p> : <p className={styles.empty}>Content to be added</p>}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

SopPage.propTypes = {
  code: PropTypes.string.isRequired,
};

export default SopPage;
