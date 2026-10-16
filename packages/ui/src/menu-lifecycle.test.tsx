import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useContext, useEffect, useState} from 'react';
import {expect, it, vi} from 'vitest';
import {Button} from './controls';
import {Menu} from './overlays';

vi.mock('react-aria-components', async (importOriginal) => {
  const aria = await importOriginal<typeof import('react-aria-components')>();
  return {
    ...aria,
    Popover: (props: React.ComponentProps<typeof aria.Popover>) => {
      const state = useContext(aria.OverlayTriggerStateContext);
      const [ready, setReady] = useState(false);
      // Real browser portals can attach their ref after the Menu's opening effect.
      useEffect(() => setReady(Boolean(state?.isOpen)), [state?.isOpen]);
      return ready ? <aria.Popover {...props}/> : null;
    }
  };
});

it('dismisses a Menu whose popover mounts after the opening effect', async () => {
  const user = userEvent.setup();
  render(<><Menu label="Keys" trigger={<Button>Choose key</Button>} items={[{id: 'manage', label: 'Manage'}]} onAction={() => undefined}/><p>Outside surface</p></>);
  const trigger = screen.getByRole('button', {name: 'Choose key'});
  await user.click(trigger);
  expect(await screen.findByRole('menu')).toBeInTheDocument();
  await user.click(trigger);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.click(trigger);
  expect(await screen.findByRole('menu')).toBeInTheDocument();
  await user.click(screen.getByText('Outside surface'));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
