import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import DeliveryCenters from './components/DeliveryCenters';
import MasterDataView from './components/MasterDataView';
import Footer from './components/Footer';
import { useLocationHash } from './hooks/useLocationHash';

function App() {
  const hash = useLocationHash();

  return (
    <>
      <Header />
      <main>
        {hash === '#master-data' ? (
          <MasterDataView />
        ) : (
          <>
            <Hero />
            <ServicesSection />
            <DeliveryCenters />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

export default App;
