import { useCallback, useEffect, useRef } from 'react';
import type { SolveRequest, SolveResponse } from './solver.worker';

// One background worker per panel. Only answers to the latest request are
// passed on; a newer start makes older answers stale.
export function useSolver(onResponse: (response: SolveResponse) => void) {
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);
  const handler = useRef(onResponse);
  useEffect(() => {
    handler.current = onResponse;
  });
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );

  return useCallback((request: Omit<SolveRequest, 'id'>): number => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL('./solver.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current.onmessage = (event: MessageEvent<SolveResponse>) => {
        if (event.data.id === latest.current) handler.current(event.data);
      };
    }
    const id = ++latest.current;
    worker.current.postMessage({ ...request, id });
    return id;
  }, []);
}
