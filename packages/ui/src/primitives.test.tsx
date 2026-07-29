import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {
  AccountMenu,
  Avatar,
  Button,
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
