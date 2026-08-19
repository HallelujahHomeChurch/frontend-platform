import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {readFileSync} from 'node:fs';
import {useRef, useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  AccountMenu,
  AlertDialog,
  Avatar,
  BrandLoadingScreen,
  Button,
  Card,
  ContextMenu,
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
  SearchableSelect,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  ToastProvider,
  useToast
} from './index';

describe('HHC UI primitives', () => {
  afterEach(() => vi.useRealTimers());

  it('renders the shared branded loading screen with accessible status semantics', () => {
    const {rerender} = render(<BrandLoadingScreen label="正在載入" className="consumer-loading" />);
    const status = screen.getByRole('status');

    expect(status).toHaveClass('hhc-brand-loading-screen', 'consumer-loading');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('正在載入')).toHaveClass('hhc-brand-loading-screen__label');
    expect(status.querySelector('img')).toHaveAttribute('src', '/assets/brand/logo.png');
    expect(status.querySelector('img')).toHaveAttribute('alt', '');

    rerender(<BrandLoadingScreen label="Loading" logoSrc="/brand/custom.png" />);
    expect(screen.getByRole('status').querySelector('img')).toHaveAttribute('src', '/brand/custom.png');
  });

  it('keeps the loading screen full viewport and stops only its motion when reduced', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toMatch(/\.hhc-brand-loading-screen\s*\{[^}]*min-block-size:\s*100vh[^}]*min-block-size:\s*100dvh/s);
    expect(styles).toMatch(/\.hhc-brand-loading-screen__ring[^}]*border[^}]*var\(--hhc-primary\)[^}]*animation:\s*hhc-brand-loading-spin/s);
    expect(styles).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.hhc-brand-loading-screen__ring[^}]*animation:\s*none/s);
  });
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
    expect(styles).toMatch(/\.hhc-icon-button[^}]*inline-size:\s*40px[^}]*block-size:\s*40px[^}]*min-inline-size:\s*40px[^}]*min-block-size:\s*40px[^}]*aspect-ratio:\s*1[^}]*border-radius:\s*50%[^}]*flex:\s*none/s);
    expect(styles).toMatch(/\.hhc-icon-button\.hhc-button--sm[^}]*inline-size:\s*34px[^}]*block-size:\s*34px/s);
    expect(styles).toMatch(/\.hhc-icon-button\.hhc-button--lg[^}]*inline-size:\s*44px[^}]*block-size:\s*44px/s);
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
        <Menu label="Actions" items={[{id: 'profile', label: 'Profile'}, {id: 'sign-out', label: 'Sign out', variant: 'danger'}]} onAction={() => undefined} />
        <button>Outside</button>
      </div>
    );

    await user.click(screen.getByRole('button', {name: 'Actions'}));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Profile'})).toHaveClass('hhc-menu__item--default');
    expect(screen.getByRole('menuitem', {name: 'Sign out'})).toHaveClass('hhc-menu__item--danger');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Actions'}));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('positions a controlled context menu at its pointer coordinates and keeps it inside the viewport', () => {
    const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 320});
    Object.defineProperty(window, 'innerHeight', {configurable: true, value: 200});
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 120,
      left: 0,
      right: 180,
      top: 0,
      width: 180,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    try {
      render(<ContextMenu label="Actions" x={300} y={190} isOpen items={[{id: 'copy', label: 'Copy'}]} onAction={() => undefined} onOpenChange={() => undefined} />);
      const overlay = screen.getByRole('menu').parentElement;

      expect(overlay).toHaveStyle({left: '140px', top: '80px'});
    } finally {
      rect.mockRestore();
      Object.defineProperty(window, 'innerWidth', width!);
      Object.defineProperty(window, 'innerHeight', height!);
    }
  });

  it('keeps an oversized context menu in the viewport and scrollable', () => {
    const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', {configurable: true, value: 200});
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 360,
      left: 0,
      right: 180,
      top: 0,
      width: 180,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    try {
      render(<ContextMenu label="Actions" x={30} y={180} isOpen items={Array.from({length: 10}, (_, index) => ({id: `item-${index}`, label: `Item ${index}`}))} onAction={() => undefined} onOpenChange={() => undefined} />);
      const overlay = screen.getByRole('menu').parentElement!;
      const styles = readFileSync('src/styles.css', 'utf8');

      expect(overlay).toHaveStyle({top: '0px'});
      expect(styles).toMatch(/\.hhc-context-menu \.hhc-menu[^}]*max-height:\s*calc\(100dvh - 24px\)[^}]*overflow:\s*auto/s);
    } finally {
      rect.mockRestore();
      Object.defineProperty(window, 'innerHeight', height!);
    }
  });

  it('dismisses a controlled context menu with Escape or an outside click and restores focus', async () => {
    const user = userEvent.setup();
    function Example() {
      const [isOpen, setOpen] = useState(true);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef}>Trigger</button>
          <button>Outside</button>
          <ContextMenu label="Actions" x={40} y={40} isOpen={isOpen} items={[{id: 'copy', label: 'Copy'}]} onAction={() => undefined} onOpenChange={setOpen} focusTriggerRef={triggerRef} />
        </>
      );
    }

    const first = render(<Example />);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Trigger'})).toHaveFocus();
    first.unmount();

    const {unmount} = render(<Example />);
    await user.click(screen.getByRole('button', {name: 'Outside'}));
    expect(screen.queryAllByRole('menu')).toHaveLength(0);
    unmount();
  });

  it('dismisses a context menu after Tab moves focus outside without reclaiming it', async () => {
    const user = userEvent.setup();
    function Example() {
      const [isOpen, setOpen] = useState(true);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef}>Trigger</button>
          <button>Before portal</button>
          <ContextMenu label="Actions" x={40} y={40} isOpen={isOpen} items={[{id: 'copy', label: 'Copy'}]} onAction={() => undefined} onOpenChange={setOpen} focusTriggerRef={triggerRef} />
        </>
      );
    }

    render(<Example />);
    const destination = document.createElement('button');
    destination.textContent = 'After portal';
    document.body.append(destination);

    try {
      await waitFor(() => expect(screen.getByRole('menuitem', {name: 'Copy'})).toHaveFocus());
      await user.tab();
      expect(destination).toHaveFocus();
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(destination).toHaveFocus();
    } finally {
      destination.remove();
    }
  });

  it('dismisses a context menu after Shift+Tab moves focus outside without reclaiming it', async () => {
    const user = userEvent.setup();
    function Example() {
      const [isOpen, setOpen] = useState(true);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef}>Trigger</button>
          <button>Before portal</button>
          <ContextMenu label="Actions" x={40} y={40} isOpen={isOpen} items={[{id: 'copy', label: 'Copy'}]} onAction={() => undefined} onOpenChange={setOpen} focusTriggerRef={triggerRef} />
        </>
      );
    }

    render(<Example />);
    await waitFor(() => expect(screen.getByRole('menuitem', {name: 'Copy'})).toHaveFocus());
    await user.tab({shift: true});
    expect(screen.getByRole('button', {name: 'Before portal'})).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByRole('button', {name: 'Before portal'})).toHaveFocus();
  });

  it('navigates a context menu by keyboard and activates the focused action', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    function Example() {
      const [isOpen, setOpen] = useState(true);
      return <ContextMenu label="Actions" x={40} y={40} isOpen={isOpen} items={[{id: 'alpha', label: 'Alpha'}, {id: 'beta', label: 'Beta'}, {id: 'gamma', label: 'Gamma'}]} onAction={onAction} onOpenChange={setOpen} />;
    }

    render(<Example />);
    const alpha = screen.getByRole('menuitem', {name: 'Alpha'});
    const beta = screen.getByRole('menuitem', {name: 'Beta'});
    const gamma = screen.getByRole('menuitem', {name: 'Gamma'});
    await waitFor(() => expect(alpha).toHaveFocus());

    await user.keyboard('{ArrowDown}');
    expect(beta).toHaveFocus();
    await user.keyboard('{End}');
    expect(gamma).toHaveFocus();
    await user.keyboard('{Home}');
    expect(alpha).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledWith('alpha');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders danger, selected, and shortcut item presentation in both menus', async () => {
    const user = userEvent.setup();
    const onMenuAction = vi.fn();
    render(
      <>
        <Menu label="Actions" items={[{id: 'delete', label: 'Delete', variant: 'danger', isSelected: true, shortcut: '⌘⌫'}, {id: 'grid', label: 'Grid', shortcut: 'G'}]} onAction={onMenuAction} />
        <ContextMenu label="Context actions" x={40} y={40} isOpen items={[{id: 'delete', label: 'Delete', variant: 'danger', isSelected: true, shortcut: '⌘⌫'}, {id: 'grid', label: 'Grid', shortcut: 'G'}]} onAction={() => undefined} onOpenChange={() => undefined} />
      </>
    );

    fireEvent.click(screen.getByRole('button', {name: 'Actions'}));
    const selectedItems = screen.getAllByRole('menuitemradio', {name: 'Delete'});
    expect(selectedItems).toHaveLength(2);
    for (const item of selectedItems) {
      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveClass('hhc-menu__item--danger');
      expect(item).toHaveAttribute('data-selected');
      expect(item.querySelector('.hhc-menu__check')).toHaveTextContent('✓');
      expect(item.querySelector('.hhc-menu__shortcut')).toHaveTextContent('⌘⌫');
    }
    for (const item of screen.getAllByRole('menuitemradio', {name: 'Grid'})) {
      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-selected');
      expect(item.querySelector('.hhc-menu__shortcut')).toHaveTextContent('G');
    }
    await user.click(within(screen.getByRole('menu', {name: 'Actions'})).getByRole('menuitemradio', {name: 'Grid'}));
    expect(onMenuAction).toHaveBeenCalledWith('grid');
  });

  it('keeps explicit all-false selection items accessible as unchecked radios and leaves ordinary menu items unindented', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ContextMenu label="View options" x={40} y={40} isOpen items={[{id: 'grid', label: 'Grid', isSelected: false}, {id: 'list', label: 'List', isSelected: false}]} onAction={() => undefined} onOpenChange={() => undefined} />
        <Menu label="Actions" items={[{id: 'copy', label: 'Copy'}]} onAction={() => undefined} />
      </>
    );

    await user.click(screen.getByRole('button', {name: 'Actions'}));
    for (const item of screen.getAllByRole('menuitemradio')) {
      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item.querySelector('.hhc-menu__check')).toBeInTheDocument();
    }
    const ordinaryItem = within(screen.getByRole('menu', {name: 'Actions'})).getByRole('menuitem', {name: 'Copy'});
    expect(ordinaryItem.querySelector('.hhc-menu__check')).toBeNull();
    expect(ordinaryItem).not.toHaveClass('hhc-menu__item--selectable');
  });

  it('rejects menus with more than one selected item', () => {
    expect(() => render(
      <ContextMenu label="View options" x={40} y={40} isOpen items={[{id: 'grid', label: 'Grid', isSelected: true}, {id: 'list', label: 'List', isSelected: true}]} onAction={() => undefined} onOpenChange={() => undefined} />
    )).toThrow('Menu items must have at most one selected item.');
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

  it('orders searchable select items by selected, user, and role sections', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <SearchableSelect
        label="Access"
        placeholder="Choose a person or role"
        inputValue="unrelated remote query"
        items={[
          {id: 'role:editor', label: 'Editors', section: 'role'},
          {id: 'user:ada', label: 'Ada', section: 'user'},
          {id: 'selected:grace', label: 'Grace', section: 'selected'}
        ]}
        emptyText="No results"
        loadingText="Loading"
        onInputChange={() => undefined}
        onOpenChange={onOpenChange}
        onSelectionChange={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', {name: /Access/}));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('searchbox', {name: 'Access'})).toHaveValue('unrelated remote query');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Grace',
      'Ada',
      'Editors'
    ]);
    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
  });

  it('keeps search inside the open selector and clears it after selection or Escape', async () => {
    const user = userEvent.setup();
    const onInputChange = vi.fn();
    const onSelectionChange = vi.fn();
    function Example() {
      const [query, setQuery] = useState('');
      return (
        <SearchableSelect
          label="Access"
          placeholder="Choose a person or role"
          inputValue={query}
          items={[
            {id: 'user:ada', label: 'Ada', section: 'user'},
            {id: 'role:editor', label: 'Editors', section: 'role'}
          ]}
          emptyText="No results"
          loadingText="Loading"
          onInputChange={(value) => {
            onInputChange(value);
            setQuery(value);
          }}
          onSelectionChange={onSelectionChange}
        />
      );
    }
    render(<Example />);

    const trigger = screen.getByRole('button', {name: /Access/});
    expect(trigger).toHaveTextContent('Choose a person or role');
    expect(screen.queryByRole('searchbox', {name: 'Access'})).not.toBeInTheDocument();

    await user.click(trigger);
    const input = screen.getByRole('searchbox', {name: 'Access'});
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, 'Ada');
    expect(onInputChange).toHaveBeenLastCalledWith('Ada');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelectionChange).toHaveBeenCalledWith('user:ada');
    expect(onInputChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByRole('searchbox', {name: 'Access'})).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onInputChange).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('dismisses the searchable select through its outside interaction layer', async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        label="Access"
        placeholder="Choose access"
        inputValue=""
        items={[{id: 'user:ada', label: 'Ada', section: 'user'}]}
        emptyText="No results"
        loadingText="Loading"
        onInputChange={() => undefined}
        onSelectionChange={() => undefined}
      />
    );

    const trigger = screen.getByRole('button', {name: /Access/});
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('searchbox', {name: 'Access'})).toHaveFocus());
    await user.click(screen.getByTestId('underlay'));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('does not select disabled items and announces loading and empty states', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const {rerender} = render(
      <SearchableSelect
        label="Access"
        placeholder="Choose access"
        inputValue=""
        items={[{id: 'user:ada', label: 'Ada', section: 'selected', isDisabled: true}]}
        emptyText="No results"
        loadingText="Loading"
        onInputChange={() => undefined}
        onSelectionChange={onSelectionChange}
      />
    );

    await user.click(screen.getByRole('button', {name: /Access/}));
    await user.click(screen.getByRole('option', {name: 'Ada'}));
    expect(onSelectionChange).not.toHaveBeenCalled();

    rerender(
      <SearchableSelect
        label="Access"
        placeholder="Choose access"
        inputValue=""
        items={[]}
        isLoading
        emptyText="No results"
        loadingText="Loading"
        onInputChange={() => undefined}
        onSelectionChange={onSelectionChange}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading');

    rerender(
      <SearchableSelect
        label="Access"
        placeholder="Choose access"
        inputValue=""
        items={[]}
        emptyText="No results"
        loadingText="Loading"
        onInputChange={() => undefined}
        onSelectionChange={onSelectionChange}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('No results');
  });

  it('opens an initially empty searchable select so it can load suggestions', async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        label="Access"
        placeholder="Choose access"
        inputValue=""
        items={[]}
        isLoading
        emptyText="No results"
        loadingText="Loading"
        onInputChange={() => undefined}
        onSelectionChange={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', {name: /Access/}));

    expect(screen.getByRole('searchbox', {name: 'Access'})).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('normalizes utility Select and the ghost compatibility alias', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select variant="utility" label="Language" hideLabel defaultSelectedKey="en-US" items={[{id: 'en-US', label: 'English (United States)'}]} />
        <Select variant="ghost" label="Legacy language" hideLabel items={[{id: 'en-US', label: 'English (United States)'}]} />
        <Select label="Disabled language" isDisabled items={[{id: 'en-US', label: 'English (United States)'}]} />
      </>
    );

    const utility = screen.getByRole('button', {name: /English \(United States\) Language/});
    expect(utility).toHaveClass('hhc-select__trigger--utility');
    expect(screen.getByRole('button', {name: /Legacy language/})).toHaveClass('hhc-select__trigger--utility');
    expect(screen.getByRole('button', {name: /Disabled language/})).toBeDisabled();
    expect(utility.querySelector('svg')).toHaveClass('hhc-select__chevron');

    await user.click(utility);
    expect(utility.closest('.hhc-select')).toHaveAttribute('data-open');
    expect(screen.getByRole('option', {name: 'English (United States)'})).toHaveAttribute('aria-selected', 'true');

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.hhc-select--utility\[data-open\][^{]*\.hhc-select__trigger--utility[^}]*background:\s*var\(--hhc-primary-soft\)/s);
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
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('option', {name: 'English'}));
    expect(trigger).toHaveFocus();
  });

  it('keeps focus on a focusable outside target when Select and AccountMenu dismiss', async () => {
    const user = userEvent.setup();
    const onOutsideAction = vi.fn();
    render(
      <>
        <Select label="Language" items={[{id: 'en', label: 'English'}]} />
        <AccountMenu user={{name: 'Ada', email: 'ada@example.com'}} labels={{menu: 'Account menu', greeting: 'Hi Ada', signOut: 'Sign out'}} onSignOut={() => undefined} />
        <button onClick={onOutsideAction}>Outside action</button>
      </>
    );

    const outside = screen.getByRole('button', {name: 'Outside action'});
    await user.click(screen.getByRole('button', {name: /Language/}));
    expect(outside.closest('[aria-hidden="true"], [inert]')).toBeNull();
    await user.click(outside);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
    expect(onOutsideAction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', {name: 'Account menu'}));
    expect(outside.closest('[aria-hidden="true"], [inert]')).toBeNull();
    await user.click(outside);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
    expect(onOutsideAction).toHaveBeenCalledTimes(2);
  });

  it('restores trigger focus when a non-focusable outside surface dismisses Select and AccountMenu', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select label="Language" items={[{id: 'en', label: 'English'}]} />
        <AccountMenu user={{name: 'Ada', email: 'ada@example.com'}} labels={{menu: 'Account menu', greeting: 'Hi Ada', signOut: 'Sign out'}} onSignOut={() => undefined} />
        <div data-testid="outside-surface">Outside surface</div>
      </>
    );

    const outside = screen.getByTestId('outside-surface');
    const selectTrigger = screen.getByRole('button', {name: /Language/});
    await user.click(selectTrigger);
    await user.click(outside);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(selectTrigger).toHaveFocus();

    const menuTrigger = screen.getByRole('button', {name: 'Account menu'});
    await user.click(menuTrigger);
    await user.click(outside);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(menuTrigger).toHaveFocus();
  });

  it('exposes compact locale labels with full accessible names and selected checks', async () => {
    const user = userEvent.setup();
    const locales = [
      {id: 'zh-Hant', label: '繁中', ariaLabel: '繁體中文'},
      {id: 'zh-Hans', label: '简中', ariaLabel: '简体中文'},
      {id: 'en', label: 'EN', ariaLabel: 'English'},
      {id: 'ja', label: '日本語', ariaLabel: '日本語'},
      {id: 'ko', label: '한국어', ariaLabel: '한국어'}
    ];
    render(<Select variant="utility" label="Language" hideLabel defaultSelectedKey="zh-Hant" items={locales} />);

    const trigger = screen.getByRole('button', {name: /繁體中文 Language/});
    expect(trigger).toHaveTextContent('繁中');
    await user.click(trigger);

    for (const locale of locales) {
      expect(screen.getByRole('option', {name: locale.ariaLabel})).toHaveTextContent(locale.label);
    }
    const selected = screen.getByRole('option', {name: '繁體中文'});
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.querySelector('.hhc-select__check')).toHaveTextContent('✓');
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
    expect(screen.getByText('Ada')).toBeInTheDocument();
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
        user={{name: 'Ada', email: 'an-accessible-address-that-is-long-enough-to-truncate@example.com'}}
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

    const identity = screen.getByText('an-accessible-address-that-is-long-enough-to-truncate@example.com');
    expect(identity).toHaveClass('hhc-account-menu__identity-text');
    expect(identity).toHaveAttribute('title', 'an-accessible-address-that-is-long-enough-to-truncate@example.com');

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.hhc-account-menu__trigger[^}]*inline-size:\s*40px[^}]*block-size:\s*40px[^}]*aspect-ratio:\s*1[^}]*flex:\s*none/s);
    expect(styles).toMatch(/\.hhc-menu__item[^}]*width:\s*100%[^}]*min-height:\s*44px[^}]*align-items:\s*center[^}]*text-decoration:\s*none/s);
    expect(styles).toMatch(/\.hhc-menu__item\[data-focus-visible\][^}]*outline:\s*0[^}]*box-shadow:\s*inset 0 0 0 2px var\(--hhc-primary\)/s);
    expect(styles).toMatch(/\.hhc-account-menu__identity-text[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
    expect(styles).toMatch(/\.hhc-menu__item--default[^}]*color:\s*var\(--hhc-text\)/s);
    expect(styles).toMatch(/\.hhc-menu__item\[data-hovered\][^}]*background:\s*var\(--hhc-primary-soft\)/s);
    expect(styles).not.toMatch(/\.hhc-account-menu \.hhc-menu__item--danger\[data-hovered\][^}]*background:\s*var\(--hhc-danger-soft\)/s);
    expect(styles).toMatch(/@media \(forced-colors:\s*active\)[\s\S]*\.hhc-menu__item[^}]*border-color:\s*CanvasText/s);
    expect(styles).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.hhc-select__chevron[^}]*transition:\s*none/s);
  });

  it('shows AccountMenu focus treatment for keyboard, not pointer, activation', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Before account menu</button>
        <AccountMenu
          user={{name: 'Ada', email: 'ada@example.com'}}
          labels={{menu: 'Account menu', greeting: 'Hi Ada', signOut: 'Sign out'}}
          onSignOut={() => undefined}
        />
      </>
    );

    const trigger = screen.getByRole('button', {name: 'Account menu'});
    await user.click(trigger);
    expect(trigger).not.toHaveAttribute('data-focus-visible');
    await user.click(screen.getByRole('menuitem', {name: 'Sign out'}));
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(document.body);
    expect(trigger).toHaveFocus();

    await user.click(screen.getByRole('button', {name: 'Before account menu'}));
    await user.tab();
    expect(trigger).toHaveAttribute('data-focus-visible');
    await user.keyboard('{Enter}{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('uses two left-aligned accessible identity lines in a bounded AccountMenu popover', async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        user={{name: 'A display name that is long enough to truncate', email: 'an-accessible-address-that-is-long-enough-to-truncate@example.com'}}
        labels={{menu: 'Account menu', greeting: 'Legacy greeting', signOut: 'Sign out'}}
        onSignOut={() => undefined}
      />
    );

    await user.click(screen.getByRole('button', {name: 'Account menu'}));
    expect(screen.getByText('A display name that is long enough to truncate')).toHaveClass('hhc-account-menu__identity-text');
    expect(screen.getByText('an-accessible-address-that-is-long-enough-to-truncate@example.com')).toHaveClass('hhc-account-menu__identity-text');
    expect(screen.queryByText('Legacy greeting')).not.toBeInTheDocument();

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.hhc-account-menu \.hhc-menu__popover[^}]*width:\s*240px/s);
    expect(styles).toMatch(/\.hhc-account-menu__identity[^}]*text-align:\s*left/s);
    expect(styles).toMatch(/\.hhc-account-menu__identity-text[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s);
  });

  it('uses the shared halo and restrained popover motion', () => {
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(styles).toMatch(/\.hhc-account-menu__trigger\[data-hovered\] \.hhc-avatar[^}]*box-shadow:\s*0 0 0 4px var\(--hhc-primary-soft\)/s);
    expect(styles).toMatch(/\.hhc-menu__popover[^}]*transition:\s*opacity 120ms ease, transform 120ms ease/s);
    expect(styles).toMatch(/\.hhc-menu__popover\[data-entering\][^}]*opacity:\s*0[^}]*transform:\s*translateY\(-4px\)/s);
    expect(styles).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.hhc-menu__popover[^}]*transition:\s*none/s);
    expect(styles).toMatch(/forced-colors:\s*active[\s\S]*\.hhc-select__check[^}]*color:\s*Highlight/s);
  });

  it('gives Select popovers the same restrained motion contract', async () => {
    const user = userEvent.setup();
    render(<Select label="Language" items={[{id: 'en', label: 'English'}]} />);

    await user.click(screen.getByRole('button', {name: /Language/}));
    expect(screen.getByRole('listbox').closest('.hhc-select__popover')).toBeInTheDocument();

    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).toMatch(/\.hhc-select__popover[^}]*transition:\s*opacity 120ms ease, transform 120ms ease/s);
    expect(styles).toMatch(/\.hhc-select__popover\[data-entering\][^}]*opacity:\s*0[^}]*transform:\s*translateY\(-4px\)/s);
    expect(styles).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.hhc-select__popover[^}]*transition:\s*none/s);
  });

  it('renders one email identity line when the display name is empty', async () => {
    const user = userEvent.setup();
    render(<AccountMenu user={{name: '', email: 'ada@example.com'}} labels={{menu: 'Account menu', greeting: 'Legacy greeting', signOut: 'Sign out'}} onSignOut={() => undefined} />);

    await user.click(screen.getByRole('button', {name: 'Account menu'}));
    expect(screen.getAllByText('ada@example.com')).toHaveLength(1);
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
