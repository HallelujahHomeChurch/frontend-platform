import type {ComponentProps} from 'react';
import {
  FieldError as AriaFieldError,
  Form as AriaForm,
  Input as AriaInput,
  Label as AriaLabel,
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
