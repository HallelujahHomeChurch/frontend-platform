import {createContext, useContext, useEffect, useRef, type ComponentProps, type ReactNode} from 'react';
import {
  Dialog as AriaDialog,
  Heading,
  Modal as AriaModal,
  ModalOverlay,
  ProgressBar as AriaProgressBar
} from 'react-aria-components';

function join(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function Card({className, ...props}: ComponentProps<'section'>) {
  return <section {...props} className={join('hhc-card', className)} />;
}

Card.Header = function CardHeader({className, ...props}: ComponentProps<'header'>) {
  return <header {...props} className={join('hhc-card__header', className)} />;
};
Card.Title = function CardTitle({className, ...props}: ComponentProps<'h2'>) {
  return <h2 {...props} className={join('hhc-card__title', className)} />;
};
Card.Description = function CardDescription({className, ...props}: ComponentProps<'p'>) {
  return <p {...props} className={join('hhc-card__description', className)} />;
};
Card.Content = function CardContent({className, ...props}: ComponentProps<'div'>) {
  return <div {...props} className={join('hhc-card__content', className)} />;
};

type ModalState = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const ModalStateContext = createContext<ModalState | null>(null);

function ModalRoot({isOpen, onOpenChange, children}: ModalState & {children: ReactNode}) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  if (isOpen && !wasOpen.current) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    wasOpen.current = true;
  }

  useEffect(() => {
    if (!isOpen && wasOpen.current) {
      opener.current?.focus();
      opener.current = null;
      wasOpen.current = false;
    }
  }, [isOpen]);

  return <ModalStateContext.Provider value={{isOpen, onOpenChange}}>{children}</ModalStateContext.Provider>;
}

function ModalBackdrop({className, ...props}: Omit<ComponentProps<typeof ModalOverlay>, 'isOpen' | 'onOpenChange'>) {
  const state = useContext(ModalStateContext);
  if (!state) throw new Error('Modal.Backdrop must be used inside Modal.');
  return (
    <ModalOverlay
      {...props}
      isDismissable
      isOpen={state.isOpen}
      onOpenChange={state.onOpenChange}
      className={join('hhc-modal-overlay', typeof className === 'string' ? className : undefined)}
    />
  );
}

function ModalContainer({className, placement: _placement, ...props}: ComponentProps<typeof AriaModal> & {placement?: 'center'}) {
  return <AriaModal {...props} className={join('hhc-modal', typeof className === 'string' ? className : undefined)} />;
}

function ModalDialog({className, ...props}: ComponentProps<typeof AriaDialog>) {
  return <AriaDialog {...props} className={join('hhc-dialog', typeof className === 'string' ? className : undefined)} />;
}

function ModalSection({className, ...props}: ComponentProps<'div'>) {
  return <div {...props} className={className} />;
}

export const Modal = Object.assign(ModalRoot, {
  Backdrop: ModalBackdrop,
  Container: ModalContainer,
  Dialog: ModalDialog,
  Header: (props: ComponentProps<'header'>) => <header {...props} className={join('hhc-dialog__header', props.className)} />,
  Heading: (props: ComponentProps<typeof Heading>) => <Heading {...props} slot="title" />,
  Body: (props: ComponentProps<'div'>) => <ModalSection {...props} className={join('hhc-dialog__body', props.className)} />,
  Footer: (props: ComponentProps<'footer'>) => <footer {...props} className={join('hhc-dialog__actions', props.className)} />
});

function ProgressBarRoot({className, size: _size, ...props}: ComponentProps<typeof AriaProgressBar> & {size?: 'sm' | 'md'}) {
  return <AriaProgressBar {...props} className={join('hhc-progress', typeof className === 'string' ? className : undefined)} />;
}

export const ProgressBar = Object.assign(ProgressBarRoot, {
  Track: (props: ComponentProps<'div'>) => <div {...props} className={join('hhc-progress__track', props.className)} />,
  Fill: (props: ComponentProps<'div'>) => <div {...props} className={join('hhc-progress__fill', props.className)} />
});
