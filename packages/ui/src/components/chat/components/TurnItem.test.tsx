import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import TurnItem from './TurnItem';

describe('TurnItem', () => {
    test('renders outer section with dynamic data-testid using turn.turnId', () => {
        const mockTurn = {
            turnId: 'test-turn-123',
            userMessage: {
                info: { id: 'msg-1' } as any,
                parts: [],
            },
            assistantMessages: [],
        };

        const mockRenderMessage = () => React.createElement('div', null, 'test message');

        const markup = renderToStaticMarkup(
            <TurnItem
                turn={mockTurn as any}
                renderMessage={mockRenderMessage as any}
            />
        );

        expect(markup).toContain('data-testid="turn-test-turn-123"');
    });

    test('renders with a different turnId to verify dynamic binding', () => {
        const mockTurn = {
            turnId: 'another-turn-456',
            userMessage: {
                info: { id: 'msg-2' } as any,
                parts: [],
            },
            assistantMessages: [],
        };

        const mockRenderMessage = () => React.createElement('div', null, 'test');

        const markup = renderToStaticMarkup(
            <TurnItem
                turn={mockTurn as any}
                renderMessage={mockRenderMessage as any}
            />
        );

        expect(markup).toContain('data-testid="turn-another-turn-456"');
        expect(markup).not.toContain('data-testid="turn-test-turn-123"');
    });
});
