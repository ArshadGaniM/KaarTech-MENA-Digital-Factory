import { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import DeliveryCenters from './components/DeliveryCenters';
import Charter from './components/Charter';
import ApplicationGate from './components/ApplicationGate';
import Footer from './components/Footer';
import AppShell from './components/AppShell';
import { useLocationHash } from './hooks/useLocationHash';
import { APP_SHELL_HASHES } from './lib/navigation';
import { readApplicationUnlocked, writeApplicationUnlocked } from './lib/applicationAccess';

function App() {
  const hash = useLocationHash();
  const [unlocked, setUnlocked] = useState(readApplicationUnlocked);

  if (!APP_SHELL_HASHES.includes(hash)) {
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
    return (
      <ApplicationGate
        onUnlock={() => {
          writeApplicationUnlocked();
          setUnlocked(true);
        }}
      />
    );
  }

  return <AppShell initialHash={hash} />;
}

export default App;
