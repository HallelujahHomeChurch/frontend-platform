import type {Meta, StoryObj} from '@storybook/react-vite';
import {AccountMenu, AlertDialog, Button, Card, EmptyState, Field, OTP, Pagination, Select, Skeleton} from './index';
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
