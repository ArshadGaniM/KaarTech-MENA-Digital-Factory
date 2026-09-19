import { useEffect, useState } from 'react';

// Tracks window.location.hash so App can switch between the landing page
// and the dashboard shell without adding a router dependency.
export function useLocationHash() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return hash;
}
