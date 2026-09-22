import {Trash2, Upload} from 'lucide-react';
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
import {Button, IconButton} from './controls.js';

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
  section?: string;
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
  sectionLabels?: Partial<Record<string, string>>;
  selectedKey?: string | null;
  selectedLabel?: string;
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
  selectedKey,
  selectedLabel,
  onInputChange,
  onOpenChange,
  onSelectionChange
}: SearchableSelectProps) {
  const [isOpen, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sections = items.every((item) => item.section) ? [
    ...searchableSelectSections.map(({id}) => id).filter((id) => items.some((item) => item.section === id)),
    ...items.map((item) => item.section).filter((section): section is string => Boolean(section) && !searchableSelectSections.some(({id}) => id === section))
  ].filter((section, index, all) => all.indexOf(section) === index) : [];
  const displayValue = selectedLabel ?? placeholder;
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
      selectedKey={selectedKey ?? null}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) {
          onInputChange('');
          window.setTimeout(() => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            if (trigger.ownerDocument.activeElement === trigger.ownerDocument.body) {
              trigger.focus();
            }
          });
        }
        onOpenChange?.(open);
      }}
      onSelectionChange={(key) => {
        if (key !== null) onSelectionChange(String(key));
      }}
    >
      <span className="hhc-field__label">{label}</span>
      <AriaButton ref={triggerRef} className="hhc-searchable-select__trigger" aria-label={`${label}: ${displayValue}`}>
        <span>{displayValue}</span><span aria-hidden="true">⌄</span>
      </AriaButton>
      <Popover ref={popoverRef} className="hhc-popover hhc-searchable-select__popover">
        <div className="hhc-searchable-select__search">
          <AriaInput
            ref={inputRef}
            aria-label={label}
            className="hhc-searchable-select__input"
            placeholder={label}
            type="search"
            value={inputValue}
            onChange={(event) => onInputChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown') return;
              const option = popoverRef.current?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])');
              if (!option) return;
              event.preventDefault();
              option.focus();
            }}
          />
        </div>
        {isLoading && items.length > 0 ? <div className="hhc-searchable-select__state" role="status">{loadingText}</div> : null}
        <ListBox className="hhc-searchable-select__listbox">
          {items.length === 0 ? (
            <ListBoxItem id="__searchable-select-state" isDisabled textValue={isLoading ? loadingText : emptyText} className="hhc-searchable-select__state">
              <span role="status">{isLoading ? loadingText : emptyText}</span>
            </ListBoxItem>
          ) : sections.length === 0 ? items.map((item) => (
            <SearchableSelectOption key={item.id} item={item} />
          )) : sections.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);
            const defaultLabel = searchableSelectSections.find(({id}) => id === section)?.label ?? section;
            return (
              <ListBoxSection id={section} key={section} className="hhc-searchable-select__section">
                <Header className="hhc-searchable-select__heading">{sectionLabels?.[section] ?? defaultLabel}</Header>
                {sectionItems.map((item) => <SearchableSelectOption key={item.id} item={item} />)}
              </ListBoxSection>
            );
          })}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

function SearchableSelectOption({item}: {item: SearchableSelectItem}) {
  return (
    <ListBoxItem
      id={item.id}
      isDisabled={item.isDisabled}
      textValue={item.label}
      className={`hhc-searchable-select__option${item.section === 'selected' ? ' hhc-searchable-select__option--selected' : ''}`}
    >
      <span className="hhc-searchable-select__option-label">{item.label}</span>
      {item.description ? <span className="hhc-searchable-select__option-description">{item.description}</span> : null}
    </ListBoxItem>
  );
}

export type FileUploadItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  error?: string;
};

export type FileUploadFieldProps = {
  label: string;
  description?: string;
  accept?: string;
  items: readonly FileUploadItem[];
  maxFiles?: number;
  maxTotalBytes?: number;
  isDisabled?: boolean;
  error?: string;
  labels: {
    add: string;
    drop: string;
    selectedFiles: string;
    tooManyFiles: string;
    totalSizeExceeded: string;
    filesAdded: (count: number) => string;
    fileRemoved: (name: string) => string;
  };
  removeLabel: (item: FileUploadItem) => string;
  onFilesAdded: (files: File[]) => void;
  onRemove: (id: string) => void;
};

export function FileUploadField({
  label,
  description,
  accept,
  items,
  maxFiles,
  maxTotalBytes,
  isDisabled = false,
  error,
  labels,
  removeLabel,
  onFilesAdded,
  onRemove
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [interactionError, setInteractionError] = useState<string>();
  const [announcement, setAnnouncement] = useState('');

  function addFiles(files: File[]) {
    if (isDisabled || files.length === 0) return;
    if (maxFiles !== undefined && items.length + files.length > maxFiles) {
      setInteractionError(labels.tooManyFiles);
      return;
    }
    const totalBytes = items.reduce((total, item) => total + item.size, 0) + files.reduce((total, file) => total + file.size, 0);
    if (maxTotalBytes !== undefined && totalBytes > maxTotalBytes) {
      setInteractionError(labels.totalSizeExceeded);
      return;
    }
    setInteractionError(undefined);
    setAnnouncement(labels.filesAdded(files.length));
    onFilesAdded(files);
  }

  return (
    <div className="hhc-file-upload">
      <span className="hhc-field__label">{label}</span>
      {description ? <span className="hhc-file-upload__description">{description}</span> : null}
      <div
        className="hhc-file-upload__dropzone"
        data-dragging={isDragging || undefined}
        data-disabled={isDisabled || undefined}
        data-testid="file-upload-dropzone"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isDisabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          className="hhc-sr-only"
          type="file"
          aria-label={label}
          tabIndex={-1}
          accept={accept}
          multiple
          disabled={isDisabled}
          onChange={(event) => {
            addFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = '';
          }}
        />
        <Button type="button" variant="secondary" isDisabled={isDisabled} onPress={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" />
          {labels.add}
        </Button>
        <span className="hhc-file-upload__drop-copy">{labels.drop}</span>
      </div>
      {items.length > 0 ? (
        <ul className="hhc-file-upload__list" aria-label={labels.selectedFiles}>
          {items.map((item) => (
            <li className="hhc-file-upload__item" key={item.id}>
              <span className="hhc-file-upload__file">
                <span className="hhc-file-upload__name" title={item.name}>{item.name}</span>
                <span className="hhc-file-upload__meta">{formatFileSize(item.size)}</span>
                {item.error ? <span className="hhc-file-upload__item-error">{item.error}</span> : null}
              </span>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                aria-label={removeLabel(item)}
                isDisabled={isDisabled}
                icon={<Trash2 aria-hidden="true" />}
                onPress={() => {
                  setAnnouncement(labels.fileRemoved(item.name));
                  onRemove(item.id);
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {error ?? interactionError ? <span className="hhc-file-upload__error" role="alert">{error ?? interactionError}</span> : null}
      <span className="hhc-sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
