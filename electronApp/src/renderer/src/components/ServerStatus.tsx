import { useEffect, useState } from 'react';
import { Box, Text, HStack } from '@chakra-ui/react';

interface ServerStatus {
  isRunning: boolean;
  isStarting: boolean;
}

export const ServerStatusIndicator = () => {
  const [status, setStatus] = useState<ServerStatus>({ isRunning: false, isStarting: true });
  const [serverUrl, setServerUrl] = useState<string>('');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const statusResult = await window.electron.ipcRenderer.invoke('get-server-status');
        const urlResult = await window.electron.ipcRenderer.invoke('get-server-url');
        setStatus(statusResult);
        setServerUrl(urlResult);
      } catch (error) {
        console.error('Failed to get server status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status.isRunning) return 'green.500';
    if (status.isStarting) return 'yellow.500';
    return 'red.500';
  };

  const getStatusText = () => {
    if (status.isRunning) return 'Server Running';
    if (status.isStarting) return 'Starting...';
    return 'Server Offline';
  };

  return (
    <Box
      position="fixed"
      bottom={4}
      right={4}
      bg="blackAlpha.700"
      backdropFilter="blur(10px)"
      borderRadius="md"
      p={3}
      zIndex={1000}
      border="1px solid"
      borderColor="whiteAlpha.200"
    >
      <HStack gap={2}>
        <Box
          w={2}
          h={2}
          borderRadius="full"
          bg={getStatusColor()}
          animation={status.isStarting ? 'pulse 2s infinite' : undefined}
        />
        <Box>
          <Text fontSize="xs" fontWeight="bold" color="white">
            {getStatusText()}
          </Text>
          {status.isRunning && (
            <Text fontSize="2xs" color="whiteAlpha.700">
              {serverUrl}
            </Text>
          )}
        </Box>
      </HStack>
    </Box>
  );
};

