import type {Preview} from '@storybook/react-vite';
import '../src/styles.css';

const preview: Preview = {
  parameters: {
    a11y: {test: 'error'},
    backgrounds: {disable: true}
  },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme;
      return <Story />;
    }
  ],
  globalTypes: {
    theme: {
      description: 'HHC theme',
      defaultValue: 'light',
      toolbar: {icon: 'contrast', items: ['light', 'dark']}
    }
  }
};

export default preview;
