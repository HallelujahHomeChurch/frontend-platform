import type {ReactNode} from 'react';
import {
  Cell,
  Column,
  Row,
  Table as AriaTable,
  TableBody,
  TableHeader
} from 'react-aria-components';
import {Button} from './controls';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels: {previous: string; next: string};
}

export function Pagination({page, totalPages, onPageChange, labels}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="hhc-pagination" aria-label="Pagination">
      <Button variant="ghost" isDisabled={page <= 1} onPress={() => onPageChange(page - 1)}>{labels.previous}</Button>
      <span aria-live="polite">{page} / {totalPages}</span>
      <Button variant="ghost" isDisabled={page >= totalPages} onPress={() => onPageChange(page + 1)}>{labels.next}</Button>
    </nav>
  );
}

export function Skeleton({label}: {label: string}) {
  return <div className="hhc-skeleton" aria-label={label} role="status" />;
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

export function Toast({children, tone = 'neutral'}: {children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger'}) {
  return <div className={`hhc-toast hhc-toast--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>;
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
