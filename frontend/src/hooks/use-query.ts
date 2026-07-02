import { useEffect, useState, useCallback, useRef } from "react";

// Global cache and listeners map
const queryCache = new Map<string, any>();
const queryListeners = new Map<string, Set<() => void>>();

function getCacheKey(key: any[]): string {
  return JSON.stringify(key);
}

export function invalidateQueries(options: { queryKey: any[] }) {
  const targetKeyStr = getCacheKey(options.queryKey);
  // Also match partial keys (e.g. invalidating ["projects"] matches ["projects", "slug"])
  for (const [keyStr, listeners] of queryListeners.entries()) {
    if (keyStr.startsWith(targetKeyStr.slice(0, -1))) {
      listeners.forEach((cb) => cb());
    }
  }
}

export function useQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  refetchInterval,
}: {
  queryKey: any[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const cacheKey = getCacheKey(queryKey);
  const [data, setData] = useState<T | undefined>(() => queryCache.get(cacheKey));
  const [isLoading, setIsLoading] = useState(!queryCache.has(cacheKey) && enabled);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);

  const fetchQuery = useCallback(async (isSubsequent = false) => {
    if (!enabled) return;
    if (!isSubsequent && !queryCache.has(cacheKey)) {
      setIsLoading(true);
    }
    try {
      const res = await queryFnRef.current();
      queryCache.set(cacheKey, res);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, enabled]);

  // Subscribe to invalidation
  useEffect(() => {
    if (!enabled) return;

    let listeners = queryListeners.get(cacheKey);
    if (!listeners) {
      listeners = new Set();
      queryListeners.set(cacheKey, listeners);
    }
    const listener = () => {
      fetchQuery(true);
    };
    listeners.add(listener);

    // Initial fetch
    fetchQuery();

    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) {
        queryListeners.delete(cacheKey);
      }
    };
  }, [cacheKey, enabled, fetchQuery]);

  // Handle polling
  useEffect(() => {
    if (!enabled || !refetchInterval) return;
    const interval = setInterval(() => {
      fetchQuery(true);
    }, refetchInterval);
    return () => clearInterval(interval);
  }, [cacheKey, enabled, refetchInterval, fetchQuery]);

  return { data, isLoading, error, refetch: () => fetchQuery(true) };
}

export function useMutation<TVariables, TData>({
  mutationFn,
  onSuccess,
  onError,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables?: TVariables) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await mutationFn(variables as TVariables);
        if (onSuccess) onSuccess(data, variables as TVariables);
        return data;
      } catch (err) {
        setError(err as Error);
        if (onError) onError(err as Error, variables as TVariables);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, onSuccess, onError]
  );

  return { mutate, isLoading, isPending: isLoading, error };
}

export function useQueryClient() {
  return {
    invalidateQueries: (options: { queryKey: any[] }) => invalidateQueries(options),
  };
}
