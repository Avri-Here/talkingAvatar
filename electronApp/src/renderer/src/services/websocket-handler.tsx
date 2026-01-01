import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { wsService, MessageEvent } from '@/services/websocket-service';
import {
  WebSocketContext, defaultWsUrl, defaultBaseUrl,
} from '@/context/websocket-context';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { useAudioTask } from '@/components/canvas/live2d';
import { useConfig } from '@/context/character-config-context';
import { useChatHistory } from '@/context/chat-history-context';
import { toaster } from '@/components/ui/toaster';
import { useVAD } from '@/context/vad-context';
import { AiState, useAiState } from "@/context/ai-state-context";
import { useGroup } from '@/context/group-context';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { useBrowser } from '@/context/browser-context';
import { loadConfig } from '@/utils/config-loader';

function WebSocketHandler({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [wsState, setWsState] = useState<string>('CLOSED');
  const [wsUrl, setWsUrl] = useState<string>(defaultWsUrl);
  const [baseUrl, setBaseUrl] = useState<string>(defaultBaseUrl);

  useEffect(() => {
    loadConfig().then((config) => {
      setWsUrl(config.websocket.wsUrl);
      setBaseUrl(config.websocket.baseUrl);
    }).catch((error) => {
      console.error('Failed to load websocket config in handler:', error);
    });
  }, []);
  const { aiState, setAiState, backendSynthComplete, setBackendSynthComplete } = useAiState();
  const { setModelInfo } = useLive2DConfig();
  const {
    clearResponse,
    setForceNewMessage,
    appendHumanMessage,
    appendOrUpdateToolCallMessage,
    setCurrentHistoryUid,
    setMessages,
    setHistoryList,
  } = useChatHistory();
  const { addAudioTask } = useAudioTask();
  const { setConfName, setConfUid, setConfigFiles } = useConfig();
  const { setBrowserViewData } = useBrowser();
  const { setSelfUid, setGroupMembers, setIsOwner } = useGroup();
  const { startMic, stopMic, autoStartMicOnConvEnd } = useVAD();
  const autoStartMicOnConvEndRef = useRef(autoStartMicOnConvEnd);
  const { interrupt } = useInterrupt();

  const handlersRef = useRef<Record<string, (message: MessageEvent) => void>>({});

  const handleControlMessage = useCallback((controlText: string) => {
    switch (controlText) {
      case 'start-mic':
        startMic();
        break;
      case 'stop-mic':
        stopMic();
        break;
      case 'conversation-chain-start':
        setAiState('thinking-speaking');
        audioTaskQueue.clearQueue();
        clearResponse();
        break;
      case 'conversation-chain-end':
        audioTaskQueue.addTask(() => new Promise<void>((resolve) => {
          setAiState((currentState: AiState) => {
            if (currentState === 'thinking-speaking') {
              if (autoStartMicOnConvEndRef.current) startMic();
              return 'idle';
            }
            return currentState;
          });
          resolve();
        }));
        break;
    }
  }, [setAiState, clearResponse, startMic, stopMic]);

  // Define message handlers
  useEffect(() => {
    handlersRef.current = {
      control: (msg) => msg.text && handleControlMessage(msg.text),
      'set-model-and-conf': (msg) => {
        setAiState('loading');
        if (msg.conf_name) setConfName(msg.conf_name);
        if (msg.conf_uid) setConfUid(msg.conf_uid);
        if (msg.client_uid) setSelfUid(msg.client_uid);
        
        if (msg.model_info) {
          const info = { ...msg.model_info };
          if (info.url && !info.url.startsWith("http")) {
            info.url = baseUrl + info.url;
          }
          setModelInfo(info);
        }
        setAiState('idle');
      },
      'config-files': (msg) => msg.configs && setConfigFiles(msg.configs),
      'config-switched': () => {
        setAiState('idle');
        toaster.create({ title: t('notification.characterSwitched'), type: 'success', duration: 2000 });
        wsService.sendMessage({ type: 'fetch-history-list' });
        wsService.sendMessage({ type: 'create-new-history' });
      },
      audio: (msg) => {
        if (aiState !== 'interrupted' && aiState !== 'listening') {
          addAudioTask({
            audioBase64: msg.audio || '',
            volumes: msg.volumes || [],
            sliceLength: msg.slice_length || 0,
            displayText: msg.display_text || null,
            expressions: msg.actions?.expressions || null,
            forwarded: msg.forwarded || false,
          });
        }
      },
      'history-data': (msg) => {
        if (msg.messages) setMessages(msg.messages);
        toaster.create({ title: t('notification.historyLoaded'), type: 'success', duration: 2000 });
      },
      'new-history-created': (msg) => {
        setAiState('idle');
        if (msg.history_uid) {
          setCurrentHistoryUid(msg.history_uid);
          setMessages([]);
          setHistoryList((prev) => [{ uid: msg.history_uid!, latest_message: null, timestamp: new Date().toISOString() }, ...prev]);
          toaster.create({ title: t('notification.newChatHistory'), type: 'success', duration: 2000 });
        }
      },
      'history-deleted': (msg) => {
        toaster.create({
          title: msg.success ? t('notification.historyDeleteSuccess') : t('notification.historyDeleteFail'),
          type: msg.success ? 'success' : 'error',
          duration: 2000
        });
      },
      'history-list': (msg) => {
        if (msg.histories) {
          setHistoryList(msg.histories);
          if (msg.histories.length > 0) setCurrentHistoryUid(msg.histories[0].uid);
        }
      },
      'user-input-transcription': (msg) => msg.text && appendHumanMessage(msg.text),
      error: (msg) => toaster.create({ title: msg.message, type: 'error', duration: 2000 }),
      'group-update': (msg) => {
        if (msg.members) setGroupMembers(msg.members);
        if (msg.is_owner !== undefined) setIsOwner(msg.is_owner);
      },
      'group-operation-result': (msg) => toaster.create({ title: msg.message, type: msg.success ? 'success' : 'error', duration: 2000 }),
      'backend-synth-complete': () => setBackendSynthComplete(true),
      'conversation-chain-end': () => {
        if (!audioTaskQueue.hasTask()) {
          setAiState((curr) => curr === 'thinking-speaking' ? 'idle' : curr);
        }
      },
      'force-new-message': () => setForceNewMessage(true),
      'interrupt-signal': () => interrupt(false),
      tool_call_status: (msg) => {
        if (msg.tool_id && msg.tool_name && msg.status) {
          if (msg.browser_view) setBrowserViewData(msg.browser_view);
          appendOrUpdateToolCallMessage({
            id: msg.tool_id,
            type: 'tool_call_status',
            role: 'ai',
            tool_id: msg.tool_id,
            tool_name: msg.tool_name,
            name: msg.name,
            status: msg.status as ('running' | 'completed' | 'error'),
            content: msg.content || '',
            timestamp: msg.timestamp || new Date().toISOString(),
          });
        }
      }
    };
  }, [aiState, addAudioTask, appendHumanMessage, baseUrl, setAiState, setConfName, setConfUid, setConfigFiles, setCurrentHistoryUid, setHistoryList, setMessages, setModelInfo, startMic, stopMic, setSelfUid, setGroupMembers, setIsOwner, backendSynthComplete, setBackendSynthComplete, clearResponse, handleControlMessage, appendOrUpdateToolCallMessage, interrupt, setBrowserViewData, t]);

  const handleWebSocketMessage = useCallback((message: MessageEvent) => {
    const handler = handlersRef.current[message.type];
    if (handler) {
      handler(message);
    } else if (message.type !== 'frontend-playback-complete') {
      console.warn('Unknown message type:', message.type);
    }
  }, []);

  useEffect(() => {
    wsService.connect(wsUrl);
  }, [wsUrl]);

  useEffect(() => {
    const stateSubscription = wsService.onStateChange(setWsState);
    const messageSubscription = wsService.onMessage(handleWebSocketMessage);
    return () => {
      stateSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [wsUrl, handleWebSocketMessage]);

  const webSocketContextValue = useMemo(() => ({
    sendMessage: wsService.sendMessage.bind(wsService),
    wsState,
    reconnect: () => wsService.connect(wsUrl),
    wsUrl,
    setWsUrl,
    baseUrl,
    setBaseUrl,
  }), [wsState, wsUrl, baseUrl]);

  return (
    <WebSocketContext.Provider value={webSocketContextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export default WebSocketHandler;
