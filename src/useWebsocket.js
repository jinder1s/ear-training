import { useCallback, useEffect, useState } from 'react';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

export function useWebsocket(socketAddress, onOpen, onMessage, onError, onClose) {
    const [client, setClient] = useState(null);
    const [connectionFormed, setConnectionFormed] = useState(false);
    const [queuedMessages, setQueuedMessages] = useState([]);
    const [sentMessageHistory, setSentMessageHistory] = useState([]);
    const [receivedMessageHistory, setReceivedMessageHistory] = useState([]);
    const [shouldConnect, setShouldConnect] = useState(false);

    useEffect(() => {
        if (!shouldConnect) return;
        const newClient = new W3CWebSocket(socketAddress);
        newClient && setClient(newClient);
        return () => {
            newClient.close();
            setClient(null);
            setConnectionFormed(false);
        };
    }, [socketAddress, setClient, shouldConnect]);

    useEffect(() => {
        if (client) {
            client.onopen = () => {
                setConnectionFormed(true);
                onOpen();
            };
            client.onmessage = (message) => {
                setReceivedMessageHistory((history) => {
                    return [...history, message];
                });
                onMessage(message);
            };
            if (onError) {
                client.onerror = onError;
            }
            if (onClose) {
                client.onclose = onClose;
            }
        }
    }, [client, onClose, onError, onMessage, onOpen]);

    const sendMessage = useCallback(
        (message: string, client: W3CWebSocket) => {
            client.send(message);
            setSentMessageHistory((history) => {
                return [...history, { message, timestamp: '' }];
            });
        },
        [setSentMessageHistory]
    );
    const sendMessageWrapper = useCallback(
        (message: string) => {
            if (!client || !connectionFormed) {
                setQueuedMessages((messages) => [...messages, message]);
            } else {
                sendMessage(message, client);
            }
        },
        [sendMessage, client, connectionFormed]
    );

    if (client && connectionFormed && queuedMessages.length > 0) {
        sendMessage(queuedMessages[0], client);
        setQueuedMessages((pastQueue) => pastQueue.slice(1));
    }

    return {
        connected: connectionFormed,
        toggleShouldConnect: () => {
            setShouldConnect((t) => {
                return !t;
            });
        },
        websocketSend: sendMessageWrapper,
        sentMessageHistory: sentMessageHistory,
        receivedMessageHistory: receivedMessageHistory,
    };
}
