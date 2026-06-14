import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import MessageHeader from './MessageHeader';

describe('MessageHeader', () => {
    test('renders outer div with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <MessageHeader
                isUser={false}
                providerID="test-provider"
                agentName="test-agent"
                modelName="test-model"
                isDarkTheme={false}
            />
        );

        expect(markup).toContain('data-testid="message-header"');
    });

    test('renders user header with data-testid attribute', () => {
        const markup = renderToStaticMarkup(
            <MessageHeader
                isUser={true}
                providerID={null}
                agentName={undefined}
                modelName={undefined}
                isDarkTheme={false}
            />
        );

        expect(markup).toContain('data-testid="message-header"');
    });
});
