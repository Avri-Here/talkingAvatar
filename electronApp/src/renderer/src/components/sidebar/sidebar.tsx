import { Box, Button } from '@chakra-ui/react';
import {
  FiClock, FiPlus, FiChevronLeft, FiUsers
} from 'react-icons/fi';
import { memo } from 'react';
import { sidebarStyles } from './sidebar-styles';
import ChatHistoryPanel from './chat-history-panel';
import BottomTab from './bottom-tab';
import HistoryDrawer from './history-drawer';
import { useSidebar } from '@/hooks/sidebar/use-sidebar';
import GroupDrawer from './group-drawer';

// Type definitions
interface SidebarProps {
  isCollapsed?: boolean
  onToggle: () => void
}

interface HeaderButtonsProps {
  onNewHistory: () => void
}

// Reusable components
const ToggleButton = memo(({ isCollapsed, onToggle }: {
  isCollapsed: boolean
  onToggle: () => void
}) => (
  <Box
    {...sidebarStyles.sidebar.toggleButton}
    style={{
      transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
    }}
    onClick={onToggle}
  >
    <FiChevronLeft />
  </Box>
));

ToggleButton.displayName = 'ToggleButton';

const HeaderButtons = memo(({ onNewHistory }: HeaderButtonsProps) => (
  <Box display="flex" gap={1}>
    <GroupDrawer>
      <Button>
        <FiUsers />
      </Button>
    </GroupDrawer>

    <HistoryDrawer>
      <Button>
        <FiClock />
      </Button>
    </HistoryDrawer>

    <Button onClick={onNewHistory}>
      <FiPlus />
    </Button>
  </Box>
));

HeaderButtons.displayName = 'HeaderButtons';

const SidebarContent = memo(({ 
  onNewHistory
}: HeaderButtonsProps) => (
  <Box {...sidebarStyles.sidebar.content}>
    <Box {...sidebarStyles.sidebar.header}>
      <HeaderButtons onNewHistory={onNewHistory} />
    </Box>
    <ChatHistoryPanel />
    <BottomTab />
  </Box>
));

SidebarContent.displayName = 'SidebarContent';

// Main component
function Sidebar({ isCollapsed = false, onToggle }: SidebarProps): JSX.Element {
  const { createNewHistory } = useSidebar();

  return (
    <Box {...sidebarStyles.sidebar.container(isCollapsed)}>
      <ToggleButton isCollapsed={isCollapsed} onToggle={onToggle} />

      {!isCollapsed && (
        <SidebarContent onNewHistory={createNewHistory} />
      )}
    </Box>
  );
}

export default Sidebar;
