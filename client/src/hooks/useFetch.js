import { useState, useEffect, useCallback, useRef } from 'react';

export default function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);

  const refetch = useCallback(async () => {
    // Only show full loading spinner on the very first fetch
    if (!hasFetched.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchFn();
      setData(res.data);
      hasFetched.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch, setData };
}
