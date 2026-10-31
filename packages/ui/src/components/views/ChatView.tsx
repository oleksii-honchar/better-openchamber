import React from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatErrorBoundary } from '@/components/chat/ChatErrorBoundary';
import { useSessionUIStore } from '@/sync/session-ui-store';

type ChatViewProps = {
    active?: boolean;
    /**
     * Controls message-history subscription independently of `active`.
     * Embedded session-chat panels keep this true so history stays visible
     * while composer focus / background work remain gated by visibility.
     */
    messagesEnabled?: boolean;
    readOnly?: boolean;
    initialAllowPromptingSubagentSessions?: boolean;
    /**
     * Surface opt-in for the composer's running-turn elapsed line, forwarded
     * through ChatContainer to the composer footer. Default OFF: a surface
     * renders the line only when its ChatView mount passes `true` (the two
     * named mounts per A-v9.1 D-5 — webui MainLayout, extension VSCodeLayout).
     */
    runningElapsedVisible?: boolean;
};

export const ChatView: React.FC<ChatViewProps> = ({
    active = true,
    messagesEnabled,
    readOnly = false,
    initialAllowPromptingSubagentSessions,
    runningElapsedVisible = false,
}) => {
    const currentSessionId = useSessionUIStore((state) => state.currentSessionId);

    return (
        <ChatErrorBoundary sessionId={currentSessionId || undefined}>
            <ChatContainer
                active={active}
                messagesEnabled={messagesEnabled}
                readOnly={readOnly}
                initialAllowPromptingSubagentSessions={initialAllowPromptingSubagentSessions}
                runningElapsedVisible={runningElapsedVisible}
            />
        </ChatErrorBoundary>
    );
};
