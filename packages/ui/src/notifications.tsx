import {Bell} from 'lucide-react';
import {Dialog, DialogTrigger, Heading, Popover} from 'react-aria-components';
import {Button, IconButton} from './controls.js';

export type NotificationLocale = 'zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko';
/** The host maps validated actions to these known application destinations. */
export type NotificationAppHref =
  | `/${NotificationLocale}/notifications`
  | `/${NotificationLocale}/member-videos/${string}`
  | `/${NotificationLocale}/organizations/requests/${string}`
  | `/${NotificationLocale}/organizations/${string}?joinRequest=${string}#join-requests`
  | `/${NotificationLocale}/literature-ministry?series=${'general' | 'children'}&issueNumber=${number}&contentLocale=${NotificationLocale}`;
export interface NotificationLink {href: NotificationAppHref; label: string}
export interface NotificationListItem {
  id: string;
  title: string;
  message: string;
  timeLabel: string;
  dateTime: string;
  isRead: boolean;
  pendingLabel?: string;
  link?: NotificationLink;
}
export interface NotificationLabels {
  title: string;
  loading: string;
  empty: string;
  retry: string;
  markRead: string;
  markAllRead: string;
  unread: string;
  read: string;
  viewAll: string;
  count: (exactCount: number | null) => string;
}
export type NotificationListState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'ready'; items: readonly NotificationListItem[]};
export interface NotificationListProps {
  state: NotificationListState;
  labels: NotificationLabels;
  onRetry?: () => void;
  onMarkRead?: (id: string) => void;
  markingReadIds?: readonly string[];
  onMarkAllRead?: () => void;
  isMarkingAllRead?: boolean;
  isMarkAllReadDisabled?: boolean;
  actionError?: string;
  onNavigate?: (href: NotificationAppHref, itemId?: string) => void;
}
function safeHref(href: string): href is NotificationAppHref {
  const locale = '(?:zh-Hant|zh-Hans|en|ja|ko)';
  const uuid = '(?!00000000-0000-0000-0000-000000000000(?:[?#]|$))[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  return new RegExp(`^/${locale}/(?:notifications|member-videos/[A-Za-z0-9_-]{1,128}|organizations/requests/${uuid}|organizations/${uuid}\\?joinRequest=${uuid}#join-requests|literature-ministry\\?series=(?:general|children)&issueNumber=[1-9][0-9]{0,9}&contentLocale=${locale})$`).test(href);
}
function AppLink({link, onNavigate, itemId}: {link: NotificationLink; onNavigate?: NotificationListProps['onNavigate']; itemId?: string}) {
  if (!safeHref(link.href)) return null;
  return <a className="hhc-notifications__link" href={link.href} onClick={event => {
    if (onNavigate && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {event.preventDefault(); onNavigate(link.href, itemId);}
  }}>{link.label}</a>;
}

/** Controlled presentation only: the host owns current authority, requests and persisted read state. */
export function NotificationList({state, labels, onRetry, onMarkRead, markingReadIds = [], onMarkAllRead, isMarkingAllRead = false, isMarkAllReadDisabled = false, actionError, onNavigate}: NotificationListProps) {
  if (state.status === 'loading') return <p role="status" aria-busy="true">{labels.loading}</p>;
  if (state.status === 'error') return <div><p role="alert">{state.message}</p>{onRetry ? <Button variant="secondary" onPress={onRetry}>{labels.retry}</Button> : null}</div>;
  return <div className="hhc-notifications">
    {actionError ? <p role="alert">{actionError}</p> : null}
    {onMarkAllRead ? <div className="hhc-notifications__toolbar"><Button variant="ghost" isDisabled={isMarkingAllRead || isMarkAllReadDisabled} onPress={onMarkAllRead}>{labels.markAllRead}</Button></div> : null}
    {state.items.length === 0 ? <p role="status">{labels.empty}</p> : <ul className="hhc-notifications__list">
      {state.items.map(item => <li key={item.id} className="hhc-notifications__item" data-read={item.isRead}>
        <div className="hhc-notifications__copy"><strong>{item.title}</strong><p>{item.message}</p>
          <div className="hhc-notifications__meta"><span>{item.isRead ? labels.read : labels.unread}</span><time dateTime={item.dateTime}>{item.timeLabel}</time></div>
          {item.pendingLabel ? <p className="hhc-notifications__pending">{item.pendingLabel}</p> : null}
          <div className="hhc-notifications__actions">{item.link ? <AppLink link={item.link} itemId={item.id} onNavigate={onNavigate} /> : null}
            {!item.isRead && onMarkRead ? <Button variant="ghost" isDisabled={isMarkingAllRead || markingReadIds.includes(item.id)} onPress={() => onMarkRead(item.id)}>{labels.markRead}</Button> : null}</div>
        </div>
      </li>)}
    </ul>}
  </div>;
}
export interface NotificationBellProps extends NotificationListProps {
  unreadCount: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  viewAllLink?: NotificationLink;
}
export function NotificationBell({unreadCount, isOpen, onOpenChange, viewAllLink, ...listProps}: NotificationBellProps) {
  const count = unreadCount !== null && Number.isSafeInteger(unreadCount) && unreadCount >= 0 ? unreadCount : null;
  return <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
    <span className="hhc-notification-bell"><IconButton variant="ghost" size="lg" aria-label={listProps.labels.count(count)} icon={<Bell size={20} aria-hidden="true" />} />
      {count !== null && count > 0 ? <span className="hhc-notification-bell__badge" aria-hidden="true">{count > 99 ? '99+' : count}</span> : null}</span>
    <Popover className="hhc-popover hhc-notification-popover" placement="bottom end">
      <Dialog className="hhc-notification-dialog"><Heading slot="title" className="hhc-notifications__heading">{listProps.labels.title}</Heading>
        <NotificationList {...listProps} />
        {viewAllLink ? <footer className="hhc-notifications__footer"><AppLink link={viewAllLink} onNavigate={listProps.onNavigate} /></footer> : null}
      </Dialog>
    </Popover>
  </DialogTrigger>;
}
