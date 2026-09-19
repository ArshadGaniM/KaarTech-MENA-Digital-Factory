import { NAV_ITEMS } from '../../lib/navigation';
import styles from './Hero.module.css';

function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>KaarTech &middot; MENA Region</p>
        <h1>
          One factory. Four delivery centers.
          <br />
          Every KaarTech engagement across MENA.
        </h1>
        <p className={styles.subhead}>
          The KaarTech MENA Digital Factory runs development, quality
          assurance, design, assessments, audits, managed support, and AI
          transformation consulting as one connected delivery operation
          &mdash; not a series of one-off projects.
        </p>
        <div className={styles.actions}>
          <a href={NAV_ITEMS[0].hash} className={styles.primaryAction}>
            Enter the Application
          </a>
          <a href="#services" className={styles.secondaryAction}>
            Explore Our Services
          </a>
          <a href="#our-delivery-centers" className={styles.secondaryAction}>
            See Our Delivery Centers
          </a>
        </div>
      </div>
    </section>
  );
}

export default Hero;
