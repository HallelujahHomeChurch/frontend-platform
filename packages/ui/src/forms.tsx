import {useEffect, useRef, useState, type ComponentProps} from 'react';
import {
  Button as AriaButton,
  FieldError as AriaFieldError,
  Form as AriaForm,
  Header,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select as AriaSelect,
  TextField as AriaTextField
} from 'react-aria-components';

function join(base: string, className: ComponentProps<'div'>['className']) {
  return [base, className].filter(Boolean).join(' ');
}

export function Form({className, ...props}: ComponentProps<typeof AriaForm>) {
  return <AriaForm {...props} className={join('hhc-form', typeof className === 'string' ? className : undefined)} />;
}

export function TextField({className, ...props}: ComponentProps<typeof AriaTextField>) {
  return <AriaTextField {...props} className={join('hhc-field', typeof className === 'string' ? className : undefined)} />;
}

export function Input({className, ...props}: ComponentProps<typeof AriaInput>) {
  return <AriaInput {...props} className={join('hhc-field__input', typeof className === 'string' ? className : undefined)} />;
}

export function Label({className, ...props}: ComponentProps<typeof AriaLabel>) {
  return <AriaLabel {...props} className={join('hhc-field__label', typeof className === 'string' ? className : undefined)} />;
}

export function FieldError({className, ...props}: ComponentProps<typeof AriaFieldError>) {
  return <AriaFieldError {...props} className={join('hhc-field__error', typeof className === 'string' ? className : undefined)} />;
}

export type SearchableSelectItem = {
  id: string;
  label: string;
  description?: string;
  section: 'selected' | 'user' | 'role';
  isDisabled?: boolean;
};

export type SearchableSelectProps = {
  label: string;
  placeholder?: string;
  inputValue: string;
  items: SearchableSelectItem[];
  isLoading?: boolean;
  emptyText: string;
  loadingText: string;
  sectionLabels?: Partial<Record<SearchableSelectItem['section'], string>>;
  onInputChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onSelectionChange: (id: string) => void;
};

const searchableSelectSections = [
  {id: 'selected', label: 'Selected'},
  {id: 'user', label: 'Users'},
  {id: 'role', label: 'Roles'}
] as const;

export function SearchableSelect({
  label,
  placeholder = label,
  inputValue,
  items,
  isLoading = false,
  emptyText,
  loadingText,
  sectionLabels,
  onInputChange,
  onOpenChange,
  onSelectionChange
}: SearchableSelectProps) {
  const [isOpen, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus());
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  return (
    <AriaSelect
      aria-label={label}
      className="hhc-searchable-select"
      isOpen={isOpen}
      selectedKey={null}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) {
          onInputChange('');
          window.setTimeout(() => triggerRef.current?.focus());
        }
        onOpenChange?.(open);
      }}
      onSelectionChange={(key) => {
        if (key !== null) onSelectionChange(String(key));
      }}
    >
      <span className="hhc-field__label">{label}</span>
      <AriaButton ref={triggerRef} className="hhc-searchable-select__trigger" aria-label={`${label}: ${placeholder}`}>
        <span>{placeholder}</span><span aria-hidden="true">⌄</span>
      </AriaButton>
      <Popover className="hhc-popover hhc-searchable-select__popover" isNonModal>
        <div className="hhc-searchable-select__search">
          <AriaInput
            ref={inputRef}
            aria-label={label}
            className="hhc-searchable-select__input"
            placeholder={label}
            type="search"
            value={inputValue}
            onChange={(event) => onInputChange(event.currentTarget.value)}
          />
        </div>
        {isLoading ? <div className="hhc-searchable-select__state" role="status">{loadingText}</div> : null}
        <ListBox
          className="hhc-searchable-select__listbox"
          renderEmptyState={() => isLoading ? null : <div className="hhc-searchable-select__state" role="status">{emptyText}</div>}
        >
          {searchableSelectSections.map((section) => {
            const sectionItems = items.filter((item) => item.section === section.id);
            if (sectionItems.length === 0) return null;
            return (
              <ListBoxSection id={section.id} key={section.id} className="hhc-searchable-select__section">
                <Header className="hhc-searchable-select__heading">{sectionLabels?.[section.id] ?? section.label}</Header>
                {sectionItems.map((item) => (
                  <ListBoxItem
                    id={item.id}
                    key={item.id}
                    isDisabled={item.isDisabled}
                    textValue={item.label}
                    className={`hhc-searchable-select__option${item.section === 'selected' ? ' hhc-searchable-select__option--selected' : ''}`}
                  >
                    <span className="hhc-searchable-select__option-label">{item.label}</span>
                    {item.description ? <span className="hhc-searchable-select__option-description">{item.description}</span> : null}
                  </ListBoxItem>
                ))}
              </ListBoxSection>
            );
          })}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
