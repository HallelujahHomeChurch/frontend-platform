import type {ReactNode} from 'react';
import {OTPInput, type OTPInputProps} from 'input-otp';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
  Tab,
  TabList,
  TabPanel,
  Tabs as AriaTabs,
  Text,
  TextField,
  type TextFieldProps
} from 'react-aria-components';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
}

export function Button({variant = 'primary', className, ...props}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={({isDisabled, isFocusVisible}) =>
        [
          'hhc-button',
          `hhc-button--${variant}`,
          isDisabled && 'is-disabled',
          isFocusVisible && 'is-focus-visible',
          typeof className === 'string' ? className : ''
        ]
          .filter(Boolean)
          .join(' ')
      }
    />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: ReactNode;
}

export function IconButton({icon, ...props}: IconButtonProps) {
  return <Button {...props} className="hhc-icon-button">{icon}</Button>;
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export function Avatar({name, src, size = 'md'}: AvatarProps) {
  return (
    <span className={`hhc-avatar hhc-avatar--${size}`} aria-label={name}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

export interface FieldProps extends TextFieldProps {
  label: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
}

export function Field({label, description, errorMessage, placeholder, ...props}: FieldProps) {
  return (
    <TextField {...props} className="hhc-field" isInvalid={Boolean(errorMessage) || props.isInvalid}>
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
      {description ? <Text slot="description">{description}</Text> : null}
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

export interface SelectItem {
  id: string;
  label: string;
  isDisabled?: boolean;
}

export interface SelectProps {
  label: string;
  items: SelectItem[];
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  isDisabled?: boolean;
}

export function Select({label, items, onSelectionChange, ...props}: SelectProps) {
  return (
    <AriaSelect
      {...props}
      className="hhc-select"
      onSelectionChange={(key) => onSelectionChange?.(String(key))}
    >
      <Label>{label}</Label>
      <AriaButton className="hhc-select__trigger">
        <SelectValue />
        <span aria-hidden="true">⌄</span>
      </AriaButton>
      <Popover className="hhc-popover">
        <ListBox className="hhc-listbox">
          {items.map((item) => (
            <ListBoxItem id={item.id} key={item.id} isDisabled={item.isDisabled} className="hhc-listbox__item">
              {item.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

export interface TabsProps {
  label: string;
  items: Array<{id: string; label: string; content: ReactNode}>;
  selectedKey?: string;
  onSelectionChange?: (key: string) => void;
}

export function Tabs({label, items, onSelectionChange, ...props}: TabsProps) {
  return (
    <AriaTabs {...props} onSelectionChange={(key) => onSelectionChange?.(String(key))} className="hhc-tabs">
      <TabList aria-label={label} className="hhc-tabs__list">
        {items.map((item) => <Tab id={item.id} key={item.id} className="hhc-tabs__tab">{item.label}</Tab>)}
      </TabList>
      {items.map((item) => <TabPanel id={item.id} key={item.id} className="hhc-tabs__panel">{item.content}</TabPanel>)}
    </AriaTabs>
  );
}

export interface OTPProps extends Omit<OTPInputProps, 'render' | 'children'> {
  label: string;
}

export function OTP({label, maxLength = 6, ...props}: OTPProps) {
  return (
    <div className="hhc-otp">
      <span id="hhc-otp-label" className="hhc-otp__label">{label}</span>
      <OTPInput
        {...props}
        maxLength={maxLength}
        aria-labelledby="hhc-otp-label"
        render={({slots}) => (
          <div className="hhc-otp__slots">
            {slots.map((slot, index) => (
              <span className={`hhc-otp__slot ${slot.isActive ? 'is-active' : ''}`} key={index}>
                {slot.char}
                {slot.hasFakeCaret ? <span className="hhc-otp__caret" /> : null}
              </span>
            ))}
          </div>
        )}
      />
    </div>
  );
}
