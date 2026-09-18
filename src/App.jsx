import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import DeliveryCenters from './components/DeliveryCenters';
import Footer from './components/Footer';
import AppShell from './components/AppShell';
import { useLocationHash } from './hooks/useLocationHash';
import { APP_SHELL_HASHES } from './lib/navigation';

function App() {
  const hash = useLocationHash();

  return APP_SHELL_HASHES.includes(hash) ? (
    <AppShell initialHash={hash} />
  ) : (
    <>
      <Header />
      <main>
        <Hero />
        <ServicesSection />
        <DeliveryCenters />
      </main>
      <Footer />
    </>
  );
}

export default App;
