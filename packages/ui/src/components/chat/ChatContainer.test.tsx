// Import polyfills before any other imports to patch Vite-specific APIs for Bun  
import '../../bun-polyfills';

import React from 'react';
import { beforeEach, afterEach, describe, expect, test, Mock } from 'bun:test';
import { renderHook, renderToStaticMarkup } from 'react-dom/server';

import { I18nProvider } from '@/lib/i18n';
import { SyncProvider } from '@/sync/sync-context';
import { ThemeSystemProvider } from '@/contexts/ThemeSystemContext';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { ChatContainer } from './ChatContainer';

const mockSdk = { init: async () => {}, on: () => {} };
const mockDirectory = '/tmp/test';

const renderWithAllProviders = (children: React.ReactNode) => {
  return renderToStaticMarkup(
    <I18nProvider>
      <SyncProvider sdk={mockSdk as any} directory={mockDirectory}>
        <ThemeSystemProvider>
          {children}
        </ThemeSystemProvider>
      </SyncProvider>
    </I18nProvider>,
  );
};

describe('ChatContainer parentSession read-only logic', () => {
  describe('explicit readOnly prop', () => {
    test('renders with readOnly prop without crashing', () => {
      renderWithAllProviders(<ChatContainer readOnly />);
    });

    test('accepts readOnly boolean prop', () => {
      const markup = renderWithAllProviders(<ChatContainer readOnly={true} />);
      
      // Should render successfully (content depends on session context)
      expect(markup).toBeDefined();
    });
  });

  describe('rendering without parentSession', () => {
    test('renders basic ChatContainer without crashing', () => {
      expect(() => {
        renderWithAllProviders(<ChatContainer />);
      }).not.toThrow();
    });
  });
});
