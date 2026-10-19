import {render, screen, within, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {NotificationBell, NotificationList, type NotificationListProps} from './notifications';
const labels = {title: 'Notifications', loading: 'Loading notifications', empty: 'No notifications', retry: 'Try again', markRead: 'Mark read', markAllRead: 'Mark all read', unread: 'Unread', read: 'Read', viewAll: 'View all', count: (count: number | null) => count === null ? 'Notifications, count unavailable' : `Notifications, ${count} unread`};
const state = {status: 'ready', items: [{id: '1', title: '<Private title>', message: 'Published', timeLabel: 'Today', dateTime: '2026-10-19T00:00:00Z', isRead: false, pendingLabel: 'Pending approval', link: {href: '/en/organizations/requests/00000000-0000-4000-8000-000000000001', label: 'View result'}}]} as const satisfies NotificationListProps['state'];
describe('controlled notifications', () => {
  it('shows the exact accessible count with a 99+ visual cap and unknown without zero', () => {
    const {rerender} = render(<NotificationBell labels={labels} unreadCount={123} isOpen={false} onOpenChange={() => {}} state={state} />);
    expect(screen.getByRole('button', {name: 'Notifications, 123 unread'})).toBeInTheDocument();
    expect(screen.getByText('99+')).toHaveAttribute('aria-hidden', 'true');
    rerender(<NotificationBell labels={labels} unreadCount={null} isOpen={false} onOpenChange={() => {}} state={state} />);
    expect(screen.getByRole('button', {name: 'Notifications, count unavailable'})).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
  it('uses a dialog with links and separate read controls, Escape restores trigger focus', async () => {
    const user = userEvent.setup();
    function Example() {const [isOpen, onOpenChange] = useState(false); return <NotificationBell labels={labels} unreadCount={1} isOpen={isOpen} onOpenChange={onOpenChange} state={state} onMarkRead={() => {}} />;}
    render(<Example />);
    const trigger = screen.getByRole('button', {name: 'Notifications, 1 unread'});
    trigger.focus(); await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', {name: labels.title});
    expect(within(dialog).getByRole('link', {name: 'View result'})).toHaveAttribute('href', '/en/organizations/requests/00000000-0000-4000-8000-000000000001');
    expect(within(dialog).getByRole('button', {name: labels.markRead})).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('renders text safely and keeps business pending distinct from persisted read', async () => {
    const onMarkRead = vi.fn(); const user = userEvent.setup();
    const {rerender} = render(<NotificationList labels={labels} state={state} onMarkRead={onMarkRead} />);
    expect(screen.getByText('<Private title>')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: labels.markRead}));
    expect(onMarkRead).toHaveBeenCalledWith('1');
    expect(screen.getByText('Unread')).toBeInTheDocument();
    rerender(<NotificationList labels={labels} state={{status: 'ready', items: [{...state.items[0], isRead: true}]}} onMarkRead={onMarkRead} />);
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: labels.markRead})).not.toBeInTheDocument();
  });
  it('distinguishes loading, unavailable and empty; errors hide old private content', async () => {
    const onRetry = vi.fn(); const user = userEvent.setup();
    const {rerender} = render(<NotificationList labels={labels} state={{status: 'loading'}} />);
    expect(screen.getByRole('status')).toHaveTextContent(labels.loading);
    rerender(<NotificationList labels={labels} state={{status: 'error', message: 'Unavailable'}} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
    expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
    expect(screen.queryByText('<Private title>')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: labels.retry})); expect(onRetry).toHaveBeenCalledOnce();
    rerender(<NotificationList labels={labels} state={{status: 'ready', items: []}} />);
    expect(screen.getByText(labels.empty)).toBeInTheDocument();
  });
  it.each([
    '/en/member-videos/recording-1',
    '/zh-Hant/organizations/00000000-0000-4000-8000-000000000001?joinRequest=00000000-0000-4000-8000-000000000001#join-requests',
    '/ja/literature-ministry?series=children&issueNumber=123&contentLocale=zh-Hant'
  ] as const)('allows the approved application destination %s', href => {
    render(<NotificationList labels={labels} state={{status: 'ready', items: [{...state.items[0], link: {href, label: 'Open'}}]}} />);
    expect(screen.getByRole('link', {name: 'Open'})).toHaveAttribute('href', href);
  });
  it('disables only supplied in-flight read controls and never interprets URLs outside app destinations', () => {
    render(<NotificationList labels={labels} state={{status: 'ready', items: [{...state.items[0], link: {href: 'https://evil.test' as never, label: 'Unsafe'}}]}} onMarkRead={() => {}} markingReadIds={['1']} onMarkAllRead={() => {}} isMarkingAllRead />);
    expect(screen.getByRole('button', {name: labels.markRead})).toBeDisabled();
    expect(screen.getByRole('button', {name: labels.markAllRead})).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
