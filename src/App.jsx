import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import DeliveryCenters from './components/DeliveryCenters';
import Footer from './components/Footer';

function App() {
  return (
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
