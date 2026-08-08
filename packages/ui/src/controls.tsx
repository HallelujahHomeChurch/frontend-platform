import {useEffect, useRef, useState, type ReactNode} from 'react';
import {parseDate} from '@internationalized/date';
import {OTPInput, type OTPInputProps} from 'input-otp';
import {ChevronDown, Search} from 'lucide-react';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as AriaDatePicker,
  DateSegment,
  Dialog as AriaDialog,
  FieldError,
  Group,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select as AriaSelect,
  SelectValue,
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
  Tab,
  TabList,
  TabPanel,
  Tabs as AriaTabs,
  Text,
  TextField,
  type TextFieldProps
} from 'react-aria-components';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'tertiary';

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

export function Button({variant = 'primary', size = 'md', className, ...props}: ButtonProps) {
  const normalizedVariant = variant === 'outline' ? 'secondary' : variant === 'tertiary' ? 'ghost' : variant;
  return (
    <AriaButton
      {...props}
      className={({isDisabled, isFocusVisible}) =>
        [
          'hhc-button',
          `hhc-button--${normalizedVariant}`,
          `hhc-button--${size}`,
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

export interface SwitchProps extends Omit<AriaSwitchProps, 'children'> {
  label: string;
  description?: string;
}

export function Switch({label, description, className, ...props}: SwitchProps) {
  return (
    <AriaSwitch
      {...props}
      aria-label={props['aria-label'] ?? label}
      className={({isDisabled, isFocusVisible, isSelected}) => [
        'hhc-switch',
        isDisabled && 'is-disabled',
        isFocusVisible && 'is-focus-visible',
        isSelected && 'is-selected',
        typeof className === 'string' ? className : ''
      ].filter(Boolean).join(' ')}
    >
      <span className="hhc-switch__track" aria-hidden="true"><span className="hhc-switch__thumb" /></span>
      <span className="hhc-switch__copy">
        <span className="hhc-switch__label">{label}</span>
        {description ? <span className="hhc-switch__description">{description}</span> : null}
      </span>
    </AriaSwitch>
  );
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export function Avatar({name, src, size = 'md', className}: AvatarProps) {
  return (
    <span className={['hhc-avatar', `hhc-avatar--${size}`, className].filter(Boolean).join(' ')} aria-label={name}>
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
  placeholder?: string;
  items: SelectItem[];
  variant?: 'default' | 'ghost';
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  isDisabled?: boolean;
  className?: string;
  triggerClassName?: string;
  hideLabel?: boolean;
}

export function Select({label, items, variant = 'default', onSelectionChange, className, triggerClassName, hideLabel, ...props}: SelectProps) {
  return (
    <AriaSelect
      {...props}
      className={['hhc-select', `hhc-select--${variant}`, className].filter(Boolean).join(' ')}
      onSelectionChange={(key) => onSelectionChange?.(String(key))}
    >
      <Label className={hideLabel ? 'hhc-sr-only' : undefined}>{label}</Label>
      <AriaButton className={['hhc-select__trigger', `hhc-select__trigger--${variant}`, triggerClassName].filter(Boolean).join(' ')}>
        <SelectValue />
        <ChevronDown aria-hidden="true" className="hhc-select__chevron" />
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

export interface ExpandableSearchFieldProps {
  label: string;
  submitLabel: string;
  clearLabel: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
  isDisabled?: boolean;
  mobileBehavior?: 'inline' | 'header-overlay';
}

export function ExpandableSearchField({label, submitLabel, clearLabel, placeholder, value, defaultValue = '', onChange, onSubmit, onClear, isDisabled, mobileBehavior = 'inline'}: ExpandableSearchFieldProps) {
  const [isExpanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(value ?? defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  function collapse({restoreFocus = false} = {}) {
    setExpanded(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function submit() {
    const trimmed = query.trim();
    if (!trimmed) {
      collapse();
      return;
    }
    onSubmit?.(trimmed);
    setExpanded(false);
  }

  useEffect(() => {
    if (!isExpanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) collapse();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  });

  return (
    <div
      ref={rootRef}
      className={`hhc-expandable-search${mobileBehavior === 'header-overlay' ? ' hhc-expandable-search--header-overlay' : ''}`}
      data-expanded={isExpanded}
    >
      <SearchField
        aria-label={label}
        className="hhc-expandable-search__field"
        value={query}
        onChange={(nextValue) => {
          setQuery(nextValue);
          onChange?.(nextValue);
        }}
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            collapse({restoreFocus: true});
          }
        }}
      >
        <Input ref={inputRef} placeholder={placeholder} />
        {query ? (
          <AriaButton
            className="hhc-expandable-search__clear"
            aria-label={clearLabel}
            onPress={() => {
              setQuery('');
              onChange?.('');
              onClear?.();
              inputRef.current?.focus();
            }}
          >×</AriaButton>
        ) : null}
      </SearchField>
      <AriaButton
        ref={triggerRef}
        className="hhc-expandable-search__trigger"
        aria-label={isExpanded ? submitLabel : label}
        isDisabled={isDisabled}
        onPress={() => {
          if (isExpanded) submit();
          else setExpanded(true);
        }}
      >
        <Search aria-hidden="true" className="hhc-expandable-search__icon" />
      </AriaButton>
    </div>
  );
}

export interface DatePickerProps {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  labels: {calendar: string; previous: string; next: string};
  isDisabled?: boolean;
  isRequired?: boolean;
}

export function DatePicker({label, value, onChange, labels, ...props}: DatePickerProps) {
  return (
    <AriaDatePicker
      {...props}
      className="hhc-date-picker"
      value={value ? parseDate(value) : null}
      onChange={(date) => onChange(date?.toString() ?? null)}
    >
      <Label>{label}</Label>
      <Group className="hhc-date-picker__group">
        <DateInput className="hhc-date-picker__input">
          {(segment) => <DateSegment segment={segment} className="hhc-date-picker__segment" />}
        </DateInput>
        <AriaButton className="hhc-date-picker__trigger" aria-label={labels.calendar}>
          <span aria-hidden="true">▦</span>
        </AriaButton>
      </Group>
      <Popover className="hhc-popover hhc-date-picker__popover">
        <AriaDialog className="hhc-date-picker__dialog">
          <Calendar className="hhc-calendar">
            <header className="hhc-calendar__header">
              <AriaButton slot="previous" className="hhc-calendar__nav" aria-label={labels.previous}>‹</AriaButton>
              <Heading />
              <AriaButton slot="next" className="hhc-calendar__nav" aria-label={labels.next}>›</AriaButton>
            </header>
            <CalendarGrid className="hhc-calendar__grid">
              <CalendarGridHeader>
                {(day) => <CalendarHeaderCell className="hhc-calendar__weekday">{day}</CalendarHeaderCell>}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => <CalendarCell date={date} className="hhc-calendar__cell" />}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </AriaDialog>
      </Popover>
    </AriaDatePicker>
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
              <span className={`hhc-otp__slot ${slot.isActive ? 'is-active' : ''}`} data-slot="input-otp-slot" key={index}>
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
