/* eslint-disable react/jsx-no-constructed-context-values */
import React, { useContext, useCallback, useState, useEffect } from 'react';
import { wsService } from '@/services/websocket-service';
import { loadConfig } from '@/utils/config-loader';

const DEFAULT_WS_URL = 'ws://127.0.0.1:12393/client-ws';
const DEFAULT_BASE_URL = 'http://127.0.0.1:12393';

export interface HistoryInfo {
  uid: string;
  latest_message: {
    role: 'human' | 'ai';
    timestamp: string;
    content: string;
  } | null;
  timestamp: string | null;
}

interface WebSocketContextProps {
  sendMessage: (message: object) => void;
  wsState: string;
  reconnect: () => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
}

export const WebSocketContext = React.createContext<WebSocketContextProps>({
  sendMessage: wsService.sendMessage.bind(wsService),
  wsState: 'CLOSED',
  reconnect: () => wsService.connect(DEFAULT_WS_URL),
  wsUrl: DEFAULT_WS_URL,
  setWsUrl: () => {},
  baseUrl: DEFAULT_BASE_URL,
  setBaseUrl: () => {},
});

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export const defaultWsUrl = DEFAULT_WS_URL;
export const defaultBaseUrl = DEFAULT_BASE_URL;

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);

  useEffect(() => {
    loadConfig().then((config) => {
      setWsUrl(config.websocket.wsUrl);
      setBaseUrl(config.websocket.baseUrl);
      wsService.connect(config.websocket.wsUrl);
    }).catch((error) => {
      console.error('Failed to load config:', error);
      wsService.connect(DEFAULT_WS_URL);
    });
  }, []);

  const handleSetWsUrl = useCallback((url: string) => {
    setWsUrl(url);
    wsService.connect(url);
  }, []);

  const value = {
    sendMessage: wsService.sendMessage.bind(wsService),
    wsState: 'CLOSED',
    reconnect: () => wsService.connect(wsUrl),
    wsUrl,
    setWsUrl: handleSetWsUrl,
    baseUrl,
    setBaseUrl,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
