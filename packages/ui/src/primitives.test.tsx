import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {readFileSync} from 'node:fs';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  AccountMenu,
  AlertDialog,
  Avatar,
  Button,
  Card,
  DatePicker,
  DataTableFrame,
  Dialog,
  Drawer,
  EmptyState,
  ExpandableSearchField,
  Field,
  IconButton,
  Menu,
  Modal,
  Pagination,
  PaginationBar,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  ToastProvider,
  useToast
} from './index';

describe('HHC UI primitives', () => {
  afterEach(() => vi.useRealTimers());
  it('keeps filled primary content readable and button content on one line', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toContain('--hhc-primary-solid: #ad493f');
    expect(styles).toContain('--hhc-primary-solid-hover: #9d3d35');
    expect(styles).toContain('--hhc-primary-solid: #b64e45');
    expect(styles).toContain('--hhc-primary-solid-hover: #a9433b');
    expect(styles).toContain('--hhc-on-primary: #fff8f4');
    expect(styles).toMatch(/\.hhc-button[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*gap:\s*8px[^}]*white-space:\s*nowrap/s);
    expect(styles).toMatch(/\.hhc-button\s*>\s*svg[^}]*flex:\s*none/s);
    expect(styles).toMatch(/\.hhc-button--primary[^}]*color:\s*var\(--hhc-on-primary\)[^}]*background:\s*var\(--hhc-primary-solid\)/s);
    expect(styles).toMatch(/\.hhc-avatar[^}]*background:\s*var\(--hhc-primary-solid\)[^}]*color:\s*var\(--hhc-on-primary\)/s);
    expect(styles).toMatch(/\.hhc-progress__fill[^}]*background:\s*var\(--hhc-primary\)/s);
    expect(styles).toMatch(/\.hhc-expandable-search[^}]*width:\s*40px[^}]*transition:\s*width/s);
    expect(styles).toMatch(/prefers-reduced-motion:[^}]*reduce[\s\S]*\.hhc-expandable-search[^}]*transition:\s*none/s);
  });

  it('supports a 44px soft icon button with shared interaction states', () => {
    render(<IconButton aria-label="Notifications" variant="soft" size="lg" icon={<svg aria-hidden="true" />} />);
    const button = screen.getByRole('button', {name: 'Notifications'});
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(button).toHaveClass('hhc-button--soft', 'hhc-button--lg', 'hhc-icon-button');
    expect(styles).toMatch(/\.hhc-button--soft[^}]*color:\s*var\(--hhc-primary\)[^}]*background:\s*var\(--hhc-primary-soft\)/s);
    expect(styles).toMatch(/\.hhc-button--lg[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.hhc-icon-button\.hhc-button--lg[^}]*width:\s*44px[^}]*padding:\s*0/s);
    expect(styles).toMatch(/\.hhc-button\[data-focus-visible\][^}]*outline:\s*2px solid var\(--hhc-primary\)/s);
    expect(styles).toMatch(/\.hhc-button\[data-disabled\][^}]*cursor:\s*not-allowed/s);
  });

  it('keeps regular card content padded and flush content opt-in', () => {
    render(
      <>
        <Card><Card.Content>Regular</Card.Content></Card>
        <Card><Card.Content isFlush>Table</Card.Content></Card>
      </>
    );

    expect(screen.getByText('Regular')).not.toHaveClass('hhc-card__content--flush');
    expect(screen.getByText('Table')).toHaveClass('hhc-card__content--flush');
  });

  it('closes menus on outside click and Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Menu label="Actions" items={[{id: 'profile', label: 'Profile'}]} onAction={() => undefined} />
        <button>Outside</button>
      </div>
    );

    await user.click(screen.getByRole('button', {name: 'Actions'}));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Actions'}));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders a round avatar fallback without shrinking the image area', () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByLabelText('Ada Lovelace')).toHaveClass('hhc-avatar');
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('exposes dialogs and drawers with accessible labels', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Dialog trigger={<Button>Open dialog</Button>} title="Edit profile">Body</Dialog>
        <Drawer trigger={<Button>Open navigation</Button>} title="Navigation">Links</Drawer>
      </>
    );

    await user.click(screen.getByRole('button', {name: 'Open dialog'}));
    expect(screen.getByRole('dialog', {name: 'Edit profile'})).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', {name: 'Open navigation'}));
    expect(screen.getByRole('dialog', {name: 'Navigation'})).toBeInTheDocument();
  });

  it('supports a branded drawer header without exposing a duplicate visible title', async () => {
    const user = userEvent.setup();
    render(
      <Drawer
        trigger={<Button>Open branded navigation</Button>}
        title="Admin navigation"
        header={<span>HHC Admin</span>}
        closeLabel="Close navigation"
      >
        Links
      </Drawer>
    );

    await user.click(screen.getByRole('button', {name: 'Open branded navigation'}));
    expect(screen.getByRole('dialog', {name: 'Admin navigation'})).toBeInTheDocument();
    expect(screen.getByText('HHC Admin')).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Admin navigation'})).toHaveClass('hhc-sr-only');
    await user.click(screen.getByRole('button', {name: 'Close navigation'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps form and collection controls typed and labeled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Field label="Email" name="email" />
        <Select label="Language" placeholder="Choose a language" items={[{id: 'en', label: 'English'}]} onSelectionChange={onChange} />
      </>
    );

    expect(screen.getByRole('textbox', {name: 'Email'})).toBeInTheDocument();
    expect(screen.getByText('Choose a language')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: /Language/}));
    await user.click(screen.getByRole('option', {name: 'English'}));
    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('supports a ghost select trigger', () => {
    render(<Select variant="ghost" label="Language" items={[{id: 'en', label: 'English'}]} />);
    expect(screen.getByRole('button', {name: /Language/})).toHaveClass('hhc-select__trigger--ghost');
    expect(screen.getByRole('button', {name: /Language/}).querySelector('svg')).toHaveClass('hhc-select__chevron');
  });

  it('rotates the select chevron only while the menu is open', async () => {
    const user = userEvent.setup();
    render(<Select label="Language" items={[{id: 'en', label: 'English'}]} />);

    const select = screen.getByRole('button', {name: /Language/}).closest('.hhc-select');
    expect(select).not.toHaveAttribute('data-open');
    await user.click(screen.getByRole('button', {name: /Language/}));
    expect(select).toHaveAttribute('data-open');

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.hhc-select\[data-open\][^{]*\.hhc-select__chevron[^}]*transform:\s*rotate\(180deg\)/s);
  });

  it('dismisses selects with Escape and outside interaction', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select label="Language" items={[{id: 'en', label: 'English'}]} />
        <button>Outside</button>
      </>
    );

    const trigger = screen.getByRole('button', {name: /Language/});
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dismisses controlled modals and restores focus to the opener', async () => {
    const user = userEvent.setup();

    function Example() {
      const [isOpen, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Edit profile</button>
          <Modal isOpen={isOpen} onOpenChange={setOpen}>
            <Modal.Backdrop>
              <Modal.Container>
                <Modal.Dialog>
                  <Modal.Header><Modal.Heading>Profile name</Modal.Heading></Modal.Header>
                  <Modal.Body>Fields</Modal.Body>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </>
      );
    }

    render(<Example />);
    const opener = screen.getByRole('button', {name: 'Edit profile'});
    await user.click(opener);
    expect(screen.getByRole('dialog', {name: 'Profile name'})).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', {name: 'Profile name'})).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps an alert dialog open until async confirmation succeeds', async () => {
    const user = userEvent.setup();
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      resolveConfirm = resolve;
    }));

    render(
      <AlertDialog
        trigger={<Button>Delete account</Button>}
        title="Delete account"
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
      />
    );

    const opener = screen.getByRole('button', {name: 'Delete account'});
    await user.click(opener);
    await user.click(screen.getByRole('button', {name: 'Delete'}));

    expect(screen.getByRole('alertdialog', {name: 'Delete account'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();

    resolveConfirm();
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });

  it('keeps an alert dialog open when async confirmation fails', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog
        trigger={<Button>Remove role</Button>}
        title="Remove role"
        description="The user will lose access."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => Promise.reject(new Error('request failed'))}
      />
    );

    await user.click(screen.getByRole('button', {name: 'Remove role'}));
    await user.click(screen.getByRole('button', {name: 'Remove'}));
    expect(await screen.findByRole('alertdialog', {name: 'Remove role'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Remove'})).toBeEnabled();
  });

  it('supports a controlled alert dialog without a trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <AlertDialog
        isOpen
        onOpenChange={onOpenChange}
        title="Discard changes"
        description="Unsaved changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByRole('alertdialog', {name: 'Discard changes'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Keep editing'}));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders pagination, loading, empty, and account states', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <>
        <Pagination page={2} totalPages={4} onPageChange={onPageChange} labels={{previous: 'Previous', next: 'Next'}} />
        <Skeleton label="Loading profile" />
        <EmptyState title="No results" />
        <AccountMenu
          user={{name: 'Ada', email: 'ada@example.com'}}
          labels={{menu: 'Account menu', greeting: 'Hi Ada', signOut: 'Sign out'}}
          onSignOut={() => undefined}
        />
      </>
    );

    await user.click(screen.getByRole('button', {name: 'Next'}));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByLabelText('Loading profile')).toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Account menu'}));
    expect(screen.getByText('Hi Ada')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Sign out'})).not.toHaveAttribute('href');
  });

  it('localizes pagination and forwards skeleton sizing classes', () => {
    render(
      <>
        <Pagination
          page={2}
          totalPages={4}
          onPageChange={() => undefined}
          labels={{navigation: '分頁', previous: '上一頁', next: '下一頁'}}
        />
        <Skeleton className="table-row-skeleton" label="正在載入" />
      </>
    );

    expect(screen.getByRole('navigation', {name: '分頁'})).toBeInTheDocument();
    expect(screen.getByLabelText('正在載入')).toHaveClass('table-row-skeleton');
  });

  it('uses link semantics for the manage-account destination', async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        user={{name: 'Ada', email: 'ada@example.com'}}
        labels={{menu: 'Account menu', greeting: 'Hi Ada', manageAccount: 'Manage account', signOut: 'Sign out'}}
        manageAccountHref="https://account.alive.org.tw/profile"
        onSignOut={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', {name: 'Account menu'}));
    expect(screen.getByRole('menuitem', {name: 'Manage account'})).toHaveAttribute(
      'href',
      'https://account.alive.org.tw/profile'
    );
  });

  it('preserves search value when dismissed and restores focus on Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div>
        <ExpandableSearchField label="Search" submitLabel="Submit search" clearLabel="Clear search" placeholder="Search this page" onChange={onChange} />
        <button>Outside</button>
      </div>
    );

    const trigger = screen.getByRole('button', {name: 'Search'});
    const shell = trigger.closest('.hhc-expandable-search');
    expect(shell).toHaveAttribute('data-expanded', 'false');
    await user.click(trigger);
    expect(shell).toHaveAttribute('data-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('searchbox', {name: 'Search'})).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(shell).toHaveAttribute('data-expanded', 'false');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.type(screen.getByRole('searchbox', {name: 'Search'}), 'weekly');
    await user.click(screen.getByRole('button', {name: 'Outside'}));
    expect(shell).toHaveAttribute('data-expanded', 'false');
    expect(onChange).not.toHaveBeenCalledWith('');

    await user.click(trigger);
    expect(screen.getByRole('searchbox', {name: 'Search'})).toHaveValue('weekly');
  });

  it('submits a trimmed query from the expanded search trigger', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ExpandableSearchField label="Search" submitLabel="Submit search" clearLabel="Clear search" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', {name: 'Search'}));
    await user.type(screen.getByRole('searchbox', {name: 'Search'}), '  weekly  ');
    await user.click(screen.getByRole('button', {name: 'Submit search'}));

    expect(onSubmit).toHaveBeenCalledWith('weekly');
    expect(screen.getByRole('button', {name: 'Search'}).closest('.hhc-expandable-search')).toHaveAttribute('data-expanded', 'false');
    await user.click(screen.getByRole('button', {name: 'Search'}));
    expect(screen.getByRole('searchbox', {name: 'Search'})).toHaveValue('  weekly  ');
  });

  it('clears search only through the explicit clear action', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <ExpandableSearchField
        label="Search"
        submitLabel="Submit search"
        clearLabel="Clear search"
        defaultValue="weekly"
        onChange={onChange}
        onClear={onClear}
      />
    );

    await user.click(screen.getByRole('button', {name: 'Search'}));
    await user.click(screen.getByRole('button', {name: 'Clear search'}));
    expect(screen.getByRole('searchbox', {name: 'Search'})).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('styles expandable search as one outline pill without an expanded trigger hover surface', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toMatch(/\.hhc-expandable-search[^}]*height:\s*40px/s);
    expect(styles).toMatch(/\.hhc-expandable-search__icon[^}]*width:\s*18px[^}]*height:\s*18px/s);
    expect(styles).toMatch(/\.hhc-expandable-search\[data-expanded='true'\][^{]*\.hhc-expandable-search__trigger\[data-hovered\][^}]*background:\s*transparent/s);
  });

  it('marks header overlay search without changing the default inline variant', () => {
    const {rerender} = render(
      <ExpandableSearchField
        label="Search"
        submitLabel="Submit search"
        clearLabel="Clear search"
        mobileBehavior="header-overlay"
      />
    );

    expect(screen.getByRole('button', {name: 'Search'}).closest('.hhc-expandable-search'))
      .toHaveClass('hhc-expandable-search--header-overlay');

    rerender(
      <ExpandableSearchField label="Search" submitLabel="Submit search" clearLabel="Clear search" />
    );
    expect(screen.getByRole('button', {name: 'Search'}).closest('.hhc-expandable-search'))
      .not.toHaveClass('hhc-expandable-search--header-overlay');
  });

  it('anchors expanded header search inside the mobile header', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toMatch(/@media \(max-width:\s*960px\)[\s\S]*\.hhc-expandable-search--header-overlay[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.hhc-expandable-search--header-overlay[^}]*inset-inline-end:\s*68px/);
    expect(styles).toMatch(/\.hhc-expandable-search--header-overlay\[data-expanded='true'\][^}]*width:\s*calc\(100% - 84px\)/);
  });

  it('queues and dismisses accessible toast notifications', async () => {
    vi.useFakeTimers();

    function Example() {
      const toast = useToast();
      return <button onClick={() => toast.add({message: 'Draft saved', tone: 'success'})}>Save</button>;
    }

    render(<ToastProvider dismissLabel="Dismiss"><Example /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved');

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Draft saved').closest('.hhc-toast')).toHaveAttribute('data-state', 'exiting');
    act(() => vi.advanceTimersByTime(150));
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('limits visible toasts and pauses dismissal while hovered', () => {
    vi.useFakeTimers();

    function Example() {
      const toast = useToast();
      return <button onClick={() => {
        for (let index = 1; index <= 4; index += 1) toast.add({message: `Notice ${index}`, durationMs: 1000});
      }}>Notify</button>;
    }

    render(<ToastProvider dismissLabel="Dismiss"><Example /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', {name: 'Notify'}));
    expect(screen.getAllByRole('status')).toHaveLength(3);
    const first = screen.getByText('Notice 1').closest('.hhc-toast')!;
    fireEvent.pointerEnter(first);
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByText('Notice 1')).toBeInTheDocument();
    fireEvent.pointerLeave(first);
    act(() => vi.advanceTimersByTime(1000));
    act(() => vi.advanceTimersByTime(150));
    expect(screen.queryByText('Notice 1')).not.toBeInTheDocument();
    expect(screen.getByText('Notice 4')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('provides an accessible animated switch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Email notifications" description="Church updates" isSelected={false} onChange={onChange} />);

    const control = screen.getByRole('switch', {name: 'Email notifications'});
    expect(control).not.toBeChecked();
    expect(control.closest('.hhc-switch')?.querySelector('.hhc-switch__thumb')).toBeInTheDocument();
    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('adds a mobile scroll affordance to data tables', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    render(<DataTableFrame><table><tbody><tr><td>Row</td></tr></tbody></table></DataTableFrame>);

    expect(document.querySelector('.hhc-data-table-frame__body')).toHaveAttribute('tabindex', '0');
    expect(styles).toMatch(/\.hhc-data-table-frame__body::after[^}]*linear-gradient/s);
  });

  it('renders compact status and table pagination metadata', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PaginationBar
        countLabel="4 items"
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
        labels={{navigation: 'Pagination', previous: 'Previous', next: 'Next'}}
      >
        <StatusBadge tone="success">Published</StatusBadge>
      </PaginationBar>
    );

    expect(screen.getByText('4 items')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Published')).toHaveClass('hhc-status-badge--success');
    await user.click(screen.getByRole('button', {name: 'Next'}));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('uses an accessible custom date picker instead of a native date input', async () => {
    const user = userEvent.setup();
    const {container} = render(
      <DatePicker
        label="Display date"
        value="2026-07-13"
        onChange={() => undefined}
        labels={{calendar: 'Choose date', previous: 'Previous month', next: 'Next month'}}
      />
    );

    expect(container.querySelector('input[type="date"]')).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', {name: /Choose date/}));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
