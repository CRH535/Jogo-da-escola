import { useEffect, useState } from 'react';
import { checkServer, type ServerStatus } from '../network/healthClient';

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>('connecting');
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const next = await checkServer(abort.signal);
      if (abort.signal.aborted) return;
      setStatus(next);
      timer = setTimeout(() => { void poll(); }, 5000);
    }
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, []);
  return status;
}
