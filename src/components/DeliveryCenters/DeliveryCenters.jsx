import styles from './DeliveryCenters.module.css';

const DELIVERY_CENTERS = [
  { city: 'Khobar', country: 'Saudi Arabia', type: 'Onshore Delivery Center' },
  { city: 'Riyadh', country: 'Saudi Arabia', type: 'Onshore Delivery Center' },
  { city: 'Chennai', country: 'India', type: 'Offshore Delivery Center' },
  { city: 'Bangalore', country: 'India', type: 'Offshore Delivery Center' },
];

function DeliveryCenters() {
  return (
    <section id="delivery-centers" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Where We Deliver From</p>
        <h2>Four ODCs, working as one factory</h2>
        <p className={styles.subhead}>
          Onshore and offshore delivery centers across Saudi Arabia and India
          operate on shared standards, so work moves between centers without
          losing continuity.
        </p>
        <div className={styles.grid}>
          {DELIVERY_CENTERS.map((center) => (
            <article key={center.city} className={styles.card}>
              <span className={styles.badge}>{center.type}</span>
              <h3>{center.city}</h3>
              <p>{center.country}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DeliveryCenters;
