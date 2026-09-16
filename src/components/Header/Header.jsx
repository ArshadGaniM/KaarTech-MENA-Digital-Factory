import styles from './Header.module.css';

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Delivery Centers', href: '#delivery-centers' },
  { label: 'Master Data', href: '#master-data' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="#top" className={styles.brand}>
          <span className={styles.brandKaartech}>KaarTech</span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandFactory}>MENA Digital Factory</span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </a>
          ))}
        </nav>
        <a href="#contact" className={styles.cta}>
          Talk to Us
        </a>
      </div>
    </header>
  );
}

export default Header;
