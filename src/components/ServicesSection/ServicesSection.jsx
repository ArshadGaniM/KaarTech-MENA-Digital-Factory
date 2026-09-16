import styles from './ServicesSection.module.css';

const SERVICES = [
  {
    title: 'Digital/AI Transformation Consulting Services',
    description:
      'Advisory and delivery support for embedding AI into existing applications and operating models.',
  },
  {
    title: 'Design Services',
    description:
      'Solution and experience design for IT applications, from architecture diagrams to interface design.',
  },
  {
    title: 'Development Services',
    description:
      'Factory-model build teams delivering new applications and enhancements against a shared engineering standard.',
  },
  {
    title: 'Quality Assurance & Testing Services',
    description:
      'Independent QA and test cycles run in parallel with delivery, catching defects before they reach production.',
  },
  {
    title: 'Operational Support Services',
    description:
      'Ongoing support and managed services for applications and infrastructure once they go live.',
  },
  {
    title: 'Assessment Services',
    description:
      'Structured assessments of existing systems, architecture, and process maturity ahead of a transformation.',
  },
  {
    title: 'Audit Services',
    description:
      'Independent audits of IT applications and processes against compliance and quality benchmarks.',
  },
];

function ServicesSection() {
  return (
    <section id="services" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>What the Factory Delivers</p>
        <h2>Seven services, one delivery operation</h2>
        <div className={styles.grid}>
          {SERVICES.map((service) => (
            <article key={service.title} className={styles.card}>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ServicesSection;
