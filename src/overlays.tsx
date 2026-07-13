import type {ReactElement, ReactNode} from 'react';
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover
} from 'react-aria-components';
import {Avatar, Button, type ButtonVariant} from './controls';

export interface MenuItem {
  id: string;
  label: string;
  isDisabled?: boolean;
  variant?: 'default' | 'danger';
}

export interface MenuProps {
  label: string;
  items: MenuItem[];
  onAction: (id: string) => void;
  trigger?: ReactElement;
  header?: ReactNode;
}

export function Menu({label, items, onAction, trigger, header}: MenuProps) {
  return (
    <MenuTrigger>
      {trigger ?? <AriaButton className="hhc-menu__trigger">{label}</AriaButton>}
      <Popover className="hhc-popover hhc-menu__popover" placement="bottom end">
        {header ? <div className="hhc-menu__header">{header}</div> : null}
        <AriaMenu aria-label={label} className="hhc-menu" onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <AriaMenuItem
              id={item.id}
              key={item.id}
              isDisabled={item.isDisabled}
              className={`hhc-menu__item ${item.variant === 'danger' ? 'hhc-menu__item--danger' : ''}`}
            >
              {item.label}
            </AriaMenuItem>
          ))}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

interface DialogBaseProps {
  trigger: ReactElement;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  isDismissable?: boolean;
  variant?: 'dialog' | 'drawer';
  role?: 'dialog' | 'alertdialog';
}

function DialogBase({trigger, title, children, isDismissable = true, variant = 'dialog', role = 'dialog'}: DialogBaseProps) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="hhc-modal-overlay" isDismissable={isDismissable}>
        <Modal className={`hhc-modal hhc-modal--${variant}`}>
          <AriaDialog role={role} className="hhc-dialog">
            {({close}) => (
              <>
                <header className="hhc-dialog__header">
                  <Heading slot="title">{title}</Heading>
                  <AriaButton className="hhc-dialog__close" onPress={close} aria-label="Close">×</AriaButton>
                </header>
                <div className="hhc-dialog__body">{typeof children === 'function' ? children(close) : children}</div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export type DialogProps = Omit<DialogBaseProps, 'variant' | 'role'>;

export function Dialog(props: DialogProps) {
  return <DialogBase {...props} />;
}

export interface AlertDialogProps extends Omit<DialogBaseProps, 'variant' | 'role' | 'children'> {
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: Extract<ButtonVariant, 'primary' | 'danger'>;
  onConfirm: () => void;
}

export function AlertDialog({description, confirmLabel, cancelLabel, confirmVariant = 'danger', onConfirm, ...props}: AlertDialogProps) {
  return (
    <DialogBase {...props} role="alertdialog" isDismissable={false}>
      <p>{description}</p>
      <div className="hhc-dialog__actions">
        <Button slot="close" variant="secondary">{cancelLabel}</Button>
        <Button slot="close" variant={confirmVariant} onPress={onConfirm}>{confirmLabel}</Button>
      </div>
    </DialogBase>
  );
}

export type DrawerProps = Omit<DialogBaseProps, 'variant' | 'role'>;

export function Drawer(props: DrawerProps) {
  return <DialogBase {...props} variant="drawer" />;
}

export interface AccountMenuProps {
  user: {name: string; email: string; avatarUrl?: string | null};
  labels: {menu: string; greeting: string; manageAccount?: string; signOut: string};
  onManageAccount?: () => void;
  onSignOut: () => void;
}

export function AccountMenu({user, labels, onManageAccount, onSignOut}: AccountMenuProps) {
  const actions: MenuItem[] = [
    ...(labels.manageAccount && onManageAccount ? [{id: 'manage', label: labels.manageAccount}] : []),
    {id: 'sign-out', label: labels.signOut, variant: 'danger' as const}
  ];
  return (
    <div className="hhc-account-menu">
      <Menu
        label={labels.menu}
        items={actions}
        header={labels.greeting}
        onAction={(id) => id === 'manage' ? onManageAccount?.() : onSignOut()}
        trigger={
          <AriaButton className="hhc-account-menu__trigger" aria-label={labels.menu}>
            <Avatar name={user.name || user.email} src={user.avatarUrl} />
          </AriaButton>
        }
      />
    </div>
  );
}
