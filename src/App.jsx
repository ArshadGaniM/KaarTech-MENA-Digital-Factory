import { useEffect, useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import DeliveryCenters from './components/DeliveryCenters';
import Charter from './components/Charter';
import SopPage from './components/SopPage';
import ApplicationGate from './components/ApplicationGate';
import Footer from './components/Footer';
import AppShell from './components/AppShell';
import { useLocationHash } from './hooks/useLocationHash';
import { APP_SHELL_HASHES } from './lib/navigation';
import { codeFromSopHash } from './data/sop';

function App() {
  const hash = useLocationHash();
  const [unlocked, setUnlocked] = useState(false);
  const inApplication = APP_SHELL_HASHES.includes(hash);
  const sopCode = codeFromSopHash(hash);

  // The password is asked on every entry: leaving the application for the portal locks it again.
  useEffect(() => {
    if (!inApplication) setUnlocked(false);
  }, [inApplication]);

  // Coming back from a service's SOP screen, the portal is drawn fresh, so scroll to the section the link names.
  useEffect(() => {
    if (!inApplication && sopCode === null && hash.length > 1) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [inApplication, sopCode, hash]);

  if (sopCode !== null) {
    return (
      <>
        <Header />
        <main>
          <SopPage code={sopCode} />
        </main>
        <Footer />
      </>
    );
  }

  if (!inApplication) {
    return (
      <>
        <Header />
        <main>
          <Hero />
          <ServicesSection />
          <DeliveryCenters />
          <Charter />
        </main>
        <Footer />
      </>
    );
  }

  if (!unlocked) {
    return <ApplicationGate onUnlock={() => setUnlocked(true)} />;
  }

  return <AppShell initialHash={hash} />;
}

export default App;
