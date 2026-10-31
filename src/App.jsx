import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import DeliveryCenters from './components/DeliveryCenters';
import InitiativePlanSection from './components/InitiativePlanSection';
import PortalGate from './components/PortalGate';
import Footer from './components/Footer';
import AppShell from './components/AppShell';
import { useLocationHash } from './hooks/useLocationHash';
import { APP_SHELL_HASHES } from './lib/navigation';
import { readPortalUnlocked, writePortalUnlocked } from './lib/portalAccess';

function Portal({ hash }) {
  const [unlocked, setUnlocked] = useState(readPortalUnlocked);

  // The sections do not exist until the portal opens, so a link such as
  // #initiative-plan has to be scrolled to once they appear.
  useEffect(() => {
    if (unlocked && hash.length > 1) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [unlocked, hash]);

  function unlock() {
    writePortalUnlocked();
    setUnlocked(true);
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        {unlocked ? (
          <>
            <ServicesSection />
            <DeliveryCenters />
            <InitiativePlanSection />
          </>
        ) : (
          <PortalGate onUnlock={unlock} />
        )}
      </main>
      {unlocked && <Footer />}
    </>
  );
}

Portal.propTypes = {
  hash: PropTypes.string.isRequired,
};

function App() {
  const hash = useLocationHash();

  return APP_SHELL_HASHES.includes(hash) ? <AppShell initialHash={hash} /> : <Portal hash={hash} />;
}

export default App;
