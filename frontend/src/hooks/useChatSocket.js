
import { useCallback, useEffect, useRef, useState } from 'react';

const WS_BASE = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/chat');

export default function useChatSocket() {
  const [status, setStatus] = useState('idle');
  const socketRef = useRef(null);
  const handlersRef = useRef({});
  const joinedConversationsRef = useRef(new Set());

  const connect = useCallback(() => {
    const token = localStorage.getItem('technova_token');
    if (!token) return;
    setStatus('connecting');

    const ws = new WebSocket(`${WS_BASE}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('open');

      for (const conversationId of joinedConversationsRef.current) {
        ws.send(JSON.stringify({ type: 'join', conversation_id: conversationId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        const handler = handlersRef.current[frame.event];
        if (handler) handler(frame);
      } catch {

      }
    };

    ws.onclose = () => {
      setStatus('closed');
      socketRef.current = null;
    };

    ws.onerror = () => {
      setStatus('closed');
    };
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    joinedConversationsRef.current.clear();
    setStatus('idle');
  }, []);

  const on = useCallback((event, handler) => {
    handlersRef.current[event] = handler;
    return () => { delete handlersRef.current[event]; };
  }, []);

  const send = useCallback((frame) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(frame));
    }
  }, []);

  const join = useCallback((conversationId, lastReceivedSequence = null) => {
    joinedConversationsRef.current.add(conversationId);
    const frame = { type: 'join', conversation_id: conversationId };
    if (lastReceivedSequence !== null) frame.last_received_sequence = lastReceivedSequence;
    send(frame);
  }, [send]);

  const leave = useCallback((conversationId) => {
    joinedConversationsRef.current.delete(conversationId);
  }, []);

  useEffect(() => {
    if (localStorage.getItem('technova_token')) connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, connect, disconnect, on, send, join, leave };
}