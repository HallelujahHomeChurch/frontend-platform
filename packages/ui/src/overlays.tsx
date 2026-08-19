import {useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject} from 'react';
import {createPortal} from 'react-dom';
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
import {Avatar, Button, type ButtonVariant} from './controls.js';

export interface MenuItem {
  id: string;
  label: string;
  href?: string;
  isDisabled?: boolean;
  isSelected?: boolean;
  shortcut?: string;
  variant?: 'default' | 'danger';
}

export interface MenuProps {
  label: string;
  items: MenuItem[];
  onAction: (id: string) => void;
  trigger?: ReactElement;
  header?: ReactNode;
  focusTriggerRef?: RefObject<HTMLButtonElement | null>;
}

function isMeaningfullyFocusable(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, iframe, audio[controls], video[controls], [contenteditable="true"], [tabindex]:not([tabindex="-1"])'));
}

function MenuItems({items}: {items: MenuItem[]}) {
  return items.map((item) => (
    <AriaMenuItem
      id={item.id}
      key={item.id}
      {...(item.href ? {href: item.href} : {})}
      isDisabled={item.isDisabled}
      className={`hhc-menu__item hhc-menu__item--${item.variant ?? 'default'}${item.isSelected ? ' hhc-menu__item--selected' : ''}`}
    >
      <span className="hhc-menu__check" aria-hidden="true">✓</span>
      <span className="hhc-menu__label">{item.label}</span>
      {item.shortcut ? <span className="hhc-menu__shortcut" aria-hidden="true">{item.shortcut}</span> : null}
    </AriaMenuItem>
  ));
}

export function Menu({label, items, onAction, trigger, header, focusTriggerRef}: MenuProps) {
  const popoverRef = useRef<HTMLElement>(null);
  const pointerStartedOutsideRef = useRef(false);
  const shouldRestoreFocusRef = useRef(true);
  const [isOpen, setOpen] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) shouldRestoreFocusRef.current = true;
    else if (shouldRestoreFocusRef.current) focusTriggerRef?.current?.focus();
  };
  useEffect(() => {
    const popover = popoverRef.current;
    if (!isOpen || !popover) return;
    const ownerDocument = popover.ownerDocument;
    const onPointerDown = (event: PointerEvent) => {
      pointerStartedOutsideRef.current = event.button === 0 && !event.composedPath().includes(popover);
      if (pointerStartedOutsideRef.current) shouldRestoreFocusRef.current = !isMeaningfullyFocusable(event.target);
    };
    const onClick = (event: MouseEvent) => {
      if (!pointerStartedOutsideRef.current || event.composedPath().includes(popover)) return;
      pointerStartedOutsideRef.current = false;
      setOpen(false);
      if (shouldRestoreFocusRef.current) focusTriggerRef?.current?.focus();
    };
    ownerDocument.addEventListener('pointerdown', onPointerDown, true);
    ownerDocument.addEventListener('click', onClick, true);
    return () => {
      ownerDocument.removeEventListener('pointerdown', onPointerDown, true);
      ownerDocument.removeEventListener('click', onClick, true);
    };
  }, [focusTriggerRef, isOpen]);
  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger ?? <AriaButton className="hhc-menu__trigger">{label}</AriaButton>}
      <Popover
        ref={popoverRef}
        className="hhc-popover hhc-menu__popover"
        placement="bottom end"
        isNonModal
      >
        {header ? <div className="hhc-menu__header">{header}</div> : null}
        <AriaMenu aria-label={label} className="hhc-menu" onAction={(key) => onAction(String(key))}>
          <MenuItems items={items} />
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export interface ContextMenuProps {
  label: string;
  items: MenuItem[];
  onAction: (id: string) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  x: number;
  y: number;
  focusTriggerRef?: RefObject<HTMLElement | null>;
}

export function ContextMenu({label, items, onAction, isOpen, onOpenChange, x, y, focusTriggerRef}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({x, y});

  const dismiss = useCallback(() => {
    onOpenChange(false);
    focusTriggerRef?.current?.focus();
  }, [focusTriggerRef, onOpenChange]);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const {width, height} = menuRef.current.getBoundingClientRect();
    setPosition({
      x: Math.max(0, Math.min(x, window.innerWidth - width)),
      y: Math.max(0, Math.min(y, window.innerHeight - height))
    });
  }, [isOpen, x, y]);

  useEffect(() => {
    if (!isOpen) return;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) dismiss();
    };
    document.addEventListener('keydown', dismissOnEscape);
    document.addEventListener('pointerdown', dismissOnOutsidePointer, true);
    return () => {
      document.removeEventListener('keydown', dismissOnEscape);
      document.removeEventListener('pointerdown', dismissOnOutsidePointer, true);
    };
  }, [dismiss, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div ref={menuRef} className="hhc-popover hhc-context-menu" style={{left: position.x, top: position.y}}>
      <AriaMenu autoFocus="first" aria-label={label} className="hhc-menu" onAction={(key) => {
        onAction(String(key));
        dismiss();
      }}>
        <MenuItems items={items} />
      </AriaMenu>
    </div>,
    document.body
  );
}

interface DialogBaseProps {
  trigger?: ReactElement;
  title: string;
  header?: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  isDismissable?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  variant?: 'dialog' | 'drawer-left' | 'drawer-right';
  role?: 'dialog' | 'alertdialog';
  closeLabel?: string;
}

function DialogBase({trigger, title, header, children, isDismissable = true, isOpen, onOpenChange, variant = 'dialog', role = 'dialog', closeLabel = 'Close'}: DialogBaseProps) {
  const overlay = (
    <ModalOverlay className="hhc-modal-overlay" isDismissable={isDismissable} isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal className={`hhc-modal hhc-modal--${variant}`}>
        <AriaDialog role={role} className="hhc-dialog">
          {({close}) => (
            <>
              <header className="hhc-dialog__header">
                <Heading slot="title" className={header ? 'hhc-sr-only' : undefined}>{title}</Heading>
                {header ? <div className="hhc-dialog__header-content">{header}</div> : null}
                <AriaButton className="hhc-dialog__close" onPress={close} aria-label={closeLabel}>×</AriaButton>
              </header>
              <div className="hhc-dialog__body">{typeof children === 'function' ? children(close) : children}</div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );

  return trigger ? <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>{trigger}{overlay}</DialogTrigger> : overlay;
}

export type DialogProps = Omit<DialogBaseProps, 'variant' | 'role' | 'header'>;

export function Dialog(props: DialogProps) {
  return <DialogBase {...props} />;
}

export interface AlertDialogProps extends Omit<DialogBaseProps, 'variant' | 'role' | 'children' | 'header'> {
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: Extract<ButtonVariant, 'primary' | 'danger'>;
  onConfirm: () => void | Promise<void>;
}

export function AlertDialog({description, confirmLabel, cancelLabel, confirmVariant = 'danger', onConfirm, ...props}: AlertDialogProps) {
  const [isPending, setPending] = useState(false);

  return (
    <DialogBase {...props} role="alertdialog" isDismissable={false}>
      {(close) => (
        <>
          <p>{description}</p>
          <div className="hhc-dialog__actions">
            <Button variant="secondary" isDisabled={isPending} onPress={close}>{cancelLabel}</Button>
            <Button
              variant={confirmVariant}
              isDisabled={isPending}
              onPress={async () => {
                setPending(true);
                try {
                  await onConfirm();
                  close();
                } catch {
                  // The caller owns error presentation; a failed action keeps the dialog open.
                } finally {
                  setPending(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </DialogBase>
  );
}

export interface DrawerProps extends Omit<DialogBaseProps, 'variant' | 'role'> {
  placement?: 'left' | 'right';
}

export function Drawer({placement = 'right', ...props}: DrawerProps) {
  return <DialogBase {...props} variant={`drawer-${placement}`} />;
}

export interface AccountMenuProps {
  user: {name: string; email: string; avatarUrl?: string | null};
  labels: {menu: string; greeting: string; manageAccount?: string; signOut: string};
  manageAccountHref?: string;
  onSignOut: () => void;
}

export function AccountMenu({user, labels, manageAccountHref, onSignOut}: AccountMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actions: MenuItem[] = [
    ...(labels.manageAccount && manageAccountHref ? [{id: 'manage', label: labels.manageAccount, href: manageAccountHref}] : []),
    {id: 'sign-out', label: labels.signOut, variant: 'danger' as const}
  ];
  return (
    <div className="hhc-account-menu">
      <Menu
        label={labels.menu}
        items={actions}
        header={
          <div className="hhc-account-menu__identity">
            <span className="hhc-account-menu__identity-text" title={user.name || user.email}>{user.name || user.email}</span>
            {user.name && user.email ? <span className="hhc-account-menu__identity-text" title={user.email}>{user.email}</span> : null}
          </div>
        }
        focusTriggerRef={triggerRef}
        onAction={(id) => { if (id === 'sign-out') onSignOut(); }}
        trigger={
          <AriaButton ref={triggerRef} className="hhc-account-menu__trigger" aria-label={labels.menu}>
            <Avatar name={user.name || user.email} src={user.avatarUrl} />
          </AriaButton>
        }
      />
    </div>
  );
}
