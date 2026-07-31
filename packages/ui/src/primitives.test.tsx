import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {readFileSync} from 'node:fs';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {
  AccountMenu,
  AlertDialog,
  Avatar,
  Button,
  Card,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  Menu,
  Modal,
  Pagination,
  Select,
  Skeleton
} from './index';

describe('HHC UI primitives', () => {
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

  it('keeps form and collection controls typed and labeled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Field label="Email" name="email" />
        <Select label="Language" items={[{id: 'en', label: 'English'}]} onSelectionChange={onChange} />
      </>
    );

    expect(screen.getByRole('textbox', {name: 'Email'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: /Language/}));
    await user.click(screen.getByRole('option', {name: 'English'}));
    expect(onChange).toHaveBeenCalledWith('en');
  });

  it('supports a ghost select trigger', () => {
    render(<Select variant="ghost" label="Language" items={[{id: 'en', label: 'English'}]} />);
    expect(screen.getByRole('button', {name: /Language/})).toHaveClass('hhc-select__trigger--ghost');
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
});
