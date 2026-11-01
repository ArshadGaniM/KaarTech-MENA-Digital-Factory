import { useCallback, useState } from 'react';
import { fetchServices } from '../lib/servicesApi';
import { useAsyncResource } from './useAsyncResource';

// The portal's services, read from the application's departments. `retry`
// loads them again after a failure.
export function useServices() {
  const [attempt, setAttempt] = useState(0);
  const resource = useAsyncResource(fetchServices, [attempt]);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { ...resource, retry };
}
