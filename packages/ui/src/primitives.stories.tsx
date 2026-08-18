import type {Meta, StoryObj} from '@storybook/react-vite';
import {Bell} from 'lucide-react';
import {useEffect, useState} from 'react';
import {
  AccountMenu,
  AlertDialog,
  BrandLoadingScreen,
  Button,
  Card,
  DataTableFrame,
  DatePicker,
  EmptyState,
  ExpandableSearchField,
  Field,
  IconButton,
  OTP,
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
import './styles.css';

const meta = {
  title: 'HHC/Primitives',
  component: Button,
  parameters: {layout: 'centered'}
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 12}}>
      <Button>Continue</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="ghost">More</Button>
      <Button variant="danger">Delete</Button>
    </div>
  )
};

export const SoftIconButton: Story = {
  render: () => <IconButton aria-label="Notifications" variant="soft" size="lg" icon={<Bell aria-hidden="true" />} />
};

export const BrandLoading: Story = {
  parameters: {layout: 'fullscreen'},
  render: () => <BrandLoadingScreen label="正在載入" />
};

export const FormControls: Story = {
  render: () => (
    <div style={{display: 'grid', gap: 20, width: 360}}>
      <Field label="Email" placeholder="you@example.com" />
      <Select label="Language" items={[{id: 'zh-Hant', label: '繁中'}, {id: 'zh-Hans', label: '简中'}, {id: 'en', label: 'EN'}]} />
      <Select variant="ghost" label="Language" hideLabel defaultSelectedKey="zh-Hant" items={[{id: 'zh-Hant', label: '繁中'}, {id: 'zh-Hans', label: '简中'}, {id: 'en', label: 'EN'}]} />
      <OTP label="Verification code" maxLength={6} />
    </div>
  )
};

function SearchableSelectExample() {
  const [query, setQuery] = useState('');
  const items = [
    {id: 'selected:ada', label: 'Ada', description: 'Already selected', section: 'selected' as const, isDisabled: true},
    {id: 'user:grace', label: 'Grace', description: 'grace@example.com', section: 'user' as const},
    {id: 'role:editors', label: 'Editors', description: 'Role', section: 'role' as const}
  ].filter((item) => item.section === 'selected' || !query || item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div style={{width: 360}}>
      <SearchableSelect
        label="Search people or roles"
        placeholder="Choose a person or role"
        inputValue={query}
        items={items}
        emptyText="No matches"
        loadingText="Loading"
        onInputChange={setQuery}
        onSelectionChange={() => setQuery('')}
      />
    </div>
  );
}

export const SearchableSelection: Story = {render: () => <SearchableSelectExample />};

export const CardVariants: Story = {
  render: () => (
    <div style={{display: 'grid', gap: 20, width: 420}}>
      <Card>
        <Card.Header><Card.Title>Profile</Card.Title></Card.Header>
        <Card.Content>Regular content uses the shared responsive inset.</Card.Content>
      </Card>
      <Card>
        <Card.Header><Card.Title>Users</Card.Title></Card.Header>
        <Card.Content isFlush>
          <div style={{padding: 20, borderTop: '1px solid var(--hhc-border)'}}>Flush content owns its internal layout.</div>
        </Card.Content>
      </Card>
    </div>
  )
};

export const AccountAndEmpty: Story = {
  render: () => (
    <div style={{display: 'flex', alignItems: 'center', gap: 48}}>
      <AccountMenu user={{name: 'Ada', email: 'ada@example.com'}} labels={{menu: 'Account menu', greeting: 'Hi Ada', manageAccount: 'Manage account', signOut: 'Sign out'}} manageAccountHref="https://account.alive.org.tw/profile" onSignOut={() => undefined} />
      <EmptyState title="No content" description="Create the first item to get started." />
    </div>
  )
};

export const OverlaysAndAsyncStates: Story = {
  render: () => (
    <div style={{display: 'grid', gap: 20, width: 360}}>
      <AlertDialog
        trigger={<Button variant="danger">Remove role</Button>}
        title="Remove role"
        description="This user will immediately lose the associated access."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => new Promise((resolve) => window.setTimeout(resolve, 800))}
      />
      <Pagination page={2} totalPages={4} onPageChange={() => undefined} labels={{navigation: 'Pagination', previous: 'Previous', next: 'Next'}} />
      <Skeleton className="table-row-skeleton" label="Loading results" />
    </div>
  )
};

function ToastExample() {
  const toast = useToast();
  return <Button onPress={() => toast.add({message: '草稿已儲存', tone: 'success'})}>顯示通知</Button>;
}

function AdminControlsExample({theme = 'light'}: {theme?: 'light' | 'dark'}) {
  const [notifications, setNotifications] = useState(true);
  useEffect(() => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = theme;
    return () => {
      if (previous) document.documentElement.dataset.theme = previous;
      else delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  return (
    <ToastProvider dismissLabel="關閉">
      <div style={{display: 'grid', gap: 20, width: 680, color: 'var(--hhc-text)', background: 'var(--hhc-canvas)', padding: 24}}>
        <div style={{display: 'flex', justifyContent: 'flex-end'}}><ExpandableSearchField label="搜尋" submitLabel="送出搜尋" clearLabel="清除搜尋" placeholder="搜尋目前頁面" /></div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
          <Select label="狀態" defaultSelectedKey="all" items={[{id: 'all', label: '所有狀態'}, {id: 'draft', label: '草稿'}]} />
          <DatePicker label="顯示日期" value="2026-07-13" onChange={() => undefined} labels={{calendar: '選擇日期', previous: '上個月', next: '下個月'}} />
          <div style={{display: 'flex', alignItems: 'end'}}><ToastExample /></div>
        </div>
        <DataTableFrame footer={<PaginationBar countLabel="4 筆內容" page={1} totalPages={2} onPageChange={() => undefined} labels={{navigation: '分頁', previous: '上一頁', next: '下一頁'}} />}>
          <div style={{display: 'flex', justifyContent: 'space-between', padding: 16}}><span>夏季聯會 2026</span><StatusBadge tone="success">已發佈</StatusBadge></div>
        </DataTableFrame>
        <div style={{display: 'flex', gap: 12}}><span>繁中</span><span>简中</span><span>English</span></div>
        <div style={{display: 'grid', gap: 12}}>
          <Switch label="電子報通知" description="接收教會消息與重要公告" isSelected={notifications} onChange={setNotifications} />
          <Switch label="儲存中" description="設定更新時會暫時停用" isSelected isDisabled />
        </div>
      </div>
    </ToastProvider>
  );
}

export const AdminControlsLight: Story = {render: () => <AdminControlsExample />};
export const AdminControlsDark: Story = {render: () => <AdminControlsExample theme="dark" />};
