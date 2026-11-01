import { useServices } from '../../hooks/useServices';
import { countWord } from '../../lib/numberWords';
import { sopHash } from '../../data/sop';
import styles from './ServicesSection.module.css';

function ServicesSection() {
  const { data: services, isLoading, error, retry } = useServices();
  const count = services?.length ?? 0;
  const heading =
    count === 0 ? 'Our services, one delivery operation' : `${countWord(count)} ${count === 1 ? 'service' : 'services'}, one delivery operation`;

  return (
    <section id="services" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>What the Factory Delivers</p>
        <h2>{heading}</h2>
        {isLoading && <p role="status">Loading the services.</p>}
        {error && !isLoading && (
          <div role="alert" className={styles.problem}>
            <p>The services could not be loaded.</p>
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {!isLoading && !error && count === 0 && <p>No services are listed yet.</p>}
        {count > 0 && (
          <div className={styles.grid}>
            {services.map((service) => (
              <article key={service.code} className={styles.card}>
                <h3>{service.title}</h3>
                {service.description && <p>{service.description}</p>}
                <a href={sopHash(service.code)} className={styles.sopLink} aria-label={`Read SOP, ${service.title}`}>
                  Read SOP <span aria-hidden="true">&rarr;</span>
                </a>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ServicesSection;
