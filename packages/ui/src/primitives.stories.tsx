import type {Meta, StoryObj} from '@storybook/react-vite';
import {AccountMenu, Button, EmptyState, Field, OTP, Select} from './index';
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
      <OTP label="Verification code" maxLength={6} />
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
