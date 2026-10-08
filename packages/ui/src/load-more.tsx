import {useEffect, useRef} from 'react';
import {Button} from './controls.js';

export interface LoadMoreTriggerProps {
  hasMore: boolean;
  loading: boolean;
  error?: boolean;
  onLoadMore: () => void;
  labels: {loadMore: string; loading: string; retry: string};
}

export function LoadMoreTrigger({hasMore, loading, error = false, onLoadMore, labels}: LoadMoreTriggerProps) {
  const target = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  useEffect(() => {
    requested.current = false;
    if (!hasMore || loading || error || !target.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !requested.current) {
        requested.current = true;
        onLoadMore();
      }
    }, {rootMargin: '300px'});
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, onLoadMore]);
  if (!hasMore) return null;
  return <div ref={target} className="hhc-load-more" aria-busy={loading}>
    <Button variant="ghost" isDisabled={loading} onPress={() => {
      if (!requested.current) {requested.current = true; onLoadMore();}
    }}>{loading ? labels.loading : error ? labels.retry : labels.loadMore}</Button>
  </div>;
}
