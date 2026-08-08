import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {CircleAlert, CircleCheck, CircleX, Info, X} from 'lucide-react';
import {
  Cell,
  Column,
  Row,
  Table as AriaTable,
  TableBody,
  TableHeader
} from 'react-aria-components';
import {Button} from './controls.js';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels: {navigation?: string; previous: string; next: string};
}

export function Pagination({page, totalPages, onPageChange, labels}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="hhc-pagination" aria-label={labels.navigation ?? 'Pagination'}>
      <Button variant="ghost" isDisabled={page <= 1} onPress={() => onPageChange(page - 1)}>{labels.previous}</Button>
      <span aria-live="polite">{page} / {totalPages}</span>
      <Button variant="ghost" isDisabled={page >= totalPages} onPress={() => onPageChange(page + 1)}>{labels.next}</Button>
    </nav>
  );
}

export function Skeleton({label, className}: {label: string; className?: string}) {
  return <div className={['hhc-skeleton', className].filter(Boolean).join(' ')} aria-label={label} role="status" />;
}

export function EmptyState({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
  return (
    <section className="hhc-empty-state">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </section>
  );
}

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

function ToastIcon({tone}: {tone: ToastTone}) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'warning' ? CircleAlert : tone === 'danger' ? CircleX : Info;
  return <Icon className="hhc-toast__icon" aria-hidden="true" />;
}

export function Toast({children, tone = 'neutral'}: {children: ReactNode; tone?: ToastTone}) {
  return <div className={`hhc-toast hhc-toast--${tone}`} data-state="visible" role={tone === 'danger' ? 'alert' : 'status'}><ToastIcon tone={tone} /><span className="hhc-toast__message">{children}</span></div>;
}

interface ToastNotice {
  id: number;
  message: ReactNode;
  tone: ToastTone;
  durationMs: number;
}

interface ToastContextValue {
  add: (notice: {message: ReactNode; tone?: ToastTone; durationMs?: number}) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}

function QueuedToast({notice, dismiss, dismissLabel}: {notice: ToastNotice; dismiss: (id: number) => void; dismissLabel: string}) {
  const [state, setState] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const [paused, setPaused] = useState(false);

  const beginExit = useCallback(() => {
    setState((current) => current === 'exiting' ? current : 'exiting');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setState('visible'), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (paused || state === 'exiting') return;
    const timer = window.setTimeout(beginExit, notice.durationMs);
    return () => window.clearTimeout(timer);
  }, [beginExit, notice.durationMs, paused, state]);

  useEffect(() => {
    if (state !== 'exiting') return;
    const timer = window.setTimeout(() => dismiss(notice.id), 150);
    return () => window.clearTimeout(timer);
  }, [dismiss, notice.id, state]);

  return (
    <div
      className={`hhc-toast hhc-toast--${notice.tone}`}
      data-state={state}
      role={notice.tone === 'danger' ? 'alert' : 'status'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <ToastIcon tone={notice.tone} />
      <span className="hhc-toast__message">{notice.message}</span>
      <button type="button" className="hhc-toast__dismiss" aria-label={dismissLabel} onClick={beginExit}><X aria-hidden="true" /></button>
    </div>
  );
}

export function ToastProvider({children, dismissLabel, regionLabel = 'Notifications'}: {children: ReactNode; dismissLabel: string; regionLabel?: string}) {
  const [notices, setNotices] = useState<ToastNotice[]>([]);
  const dismiss = useCallback((id: number) => setNotices((current) => current.filter((notice) => notice.id !== id)), []);
  const value = useMemo<ToastContextValue>(() => ({
    add(notice) {
      const id = ++nextToastId;
      setNotices((current) => [...current, {id, tone: 'neutral', durationMs: 4000, ...notice}]);
      return id;
    },
    dismiss
  }), [dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="hhc-toast-region" aria-label={regionLabel}>
        {notices.slice(0, 3).map((notice) => <QueuedToast key={notice.id} notice={notice} dismiss={dismiss} dismissLabel={dismissLabel} />)}
      </section>
    </ToastContext.Provider>
  );
}

export function StatusBadge({children, tone = 'neutral'}: {children: ReactNode; tone?: ToastTone}) {
  return <span className={`hhc-status-badge hhc-status-badge--${tone}`}>{children}</span>;
}

export function DataTableFrame({children, footer, className}: {children: ReactNode; footer?: ReactNode; className?: string}) {
  return <section className={['hhc-data-table-frame', className].filter(Boolean).join(' ')}><div className="hhc-data-table-frame__body" tabIndex={0}>{children}</div>{footer}</section>;
}

export interface PaginationBarProps extends PaginationProps {
  countLabel: ReactNode;
  children?: ReactNode;
}

export function PaginationBar({countLabel, children, page, totalPages, onPageChange, labels}: PaginationBarProps) {
  return (
    <footer className="hhc-pagination-bar">
      <div className="hhc-pagination-bar__count">{countLabel}{children}</div>
      <nav className="hhc-pagination-bar__navigation" aria-label={labels.navigation ?? 'Pagination'}>
        <Button className="hhc-pagination-bar__button" variant="ghost" isDisabled={page <= 1} aria-label={labels.previous} onPress={() => onPageChange(page - 1)}>‹</Button>
        <span aria-live="polite">{page} / {Math.max(totalPages, 1)}</span>
        <Button className="hhc-pagination-bar__button" variant="ghost" isDisabled={page >= totalPages} aria-label={labels.next} onPress={() => onPageChange(page + 1)}>›</Button>
      </nav>
    </footer>
  );
}

export interface TableColumn<T> {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  isRowHeader?: boolean;
}

export interface TableProps<T extends {id: string | number}> {
  label: string;
  columns: TableColumn<T>[];
  rows: T[];
  emptyText: string;
}

export function Table<T extends {id: string | number}>({label, columns, rows, emptyText}: TableProps<T>) {
  return (
    <AriaTable aria-label={label} className="hhc-table">
      <TableHeader>
        {columns.map((column) => <Column id={column.id} key={column.id} isRowHeader={column.isRowHeader}>{column.label}</Column>)}
      </TableHeader>
      <TableBody items={rows} renderEmptyState={() => <div className="hhc-table__empty">{emptyText}</div>}>
        {(row) => (
          <Row id={row.id}>
            {columns.map((column) => <Cell key={column.id}>{column.render(row)}</Cell>)}
          </Row>
        )}
      </TableBody>
    </AriaTable>
  );
}
