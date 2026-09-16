import styles from './Footer.module.css';

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <p className={styles.brand}>KaarTech MENA Digital Factory</p>
          <p className={styles.tagline}>
            One factory. Four delivery centers. Every KaarTech engagement
            across the MENA region.
          </p>
        </div>
        <div id="about" className={styles.about}>
          <h3>About This Factory</h3>
          <p>
            The MENA Digital Factory is KaarTech&apos;s shared delivery
            operation for the region &mdash; powering development, QA,
            design, assessments, audits, managed support, and AI
            transformation work for KaarTech&apos;s customer projects.
          </p>
        </div>
        <div className={styles.contact}>
          <h3>Contact</h3>
          <a href="mailto:mena-factory@kaartech.com">mena-factory@kaartech.com</a>
        </div>
      </div>
      <div className={styles.legal}>
        &copy; {year} KaarTech. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
