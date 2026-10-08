import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {LoadMoreTrigger} from './index.js';

afterEach(() => vi.unstubAllGlobals());
const labels = {loadMore:'Load more', loading:'Loading', retry:'Retry'};

it('loads on intersection once and disconnects while loading or after exhaustion', () => {
 let notify!: IntersectionObserverCallback;
 const disconnect=vi.fn();
 vi.stubGlobal('IntersectionObserver',class {constructor(callback:IntersectionObserverCallback){notify=callback}observe(){}disconnect(){disconnect()}});
 const load=vi.fn();
 const view=render(<LoadMoreTrigger hasMore loading={false} onLoadMore={load} labels={labels}/>);
 act(()=>{notify([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver);notify([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver)});
 expect(load).toHaveBeenCalledTimes(1);
 view.rerender(<LoadMoreTrigger hasMore loading onLoadMore={load} labels={labels}/>);
 expect(screen.getByRole('button')).toBeDisabled();expect(disconnect).toHaveBeenCalled();
 view.rerender(<LoadMoreTrigger hasMore={false} loading={false} onLoadMore={load} labels={labels}/>);
 expect(screen.queryByRole('button')).toBeNull();
});

it('does not automatically retry an error and offers manual retry without IntersectionObserver', () => {
 vi.stubGlobal('IntersectionObserver',undefined);
 const load=vi.fn();
 const view=render(<LoadMoreTrigger hasMore loading={false} error onLoadMore={load} labels={labels}/>);
 expect(load).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Retry'}));expect(load).toHaveBeenCalledTimes(1);
 view.rerender(<LoadMoreTrigger hasMore loading={false} onLoadMore={load} labels={labels}/>);
 expect(screen.getByRole('button',{name:'Load more'})).toBeEnabled();
});
