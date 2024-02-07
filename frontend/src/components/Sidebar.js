// Sidebar.js
import React from 'react';
import { SidebarContainer, SidebarItem, SidebarTitle, StatusIndicator } from './SidebarStyles';

const artifacts = [
  { name: 'MoSCoW Method', id: 1 },
  { name: 'Kano Model', id: 2 },
  { name: 'PRD', id: 3 },
  { name: 'Technical Design Doc', id: 4 },
  { name: 'Task List', id: 5 },
  // Add more artifacts here if needed
];

const Sidebar = () => {
  return (
    <SidebarContainer>
      <SidebarTitle>Project Artifacts</SidebarTitle>
      {artifacts.map((artifact) => (
        <SidebarItem key={artifact.id}>
          <StatusIndicator status={artifact.status} />
          {artifact.name}
        </SidebarItem>
      ))}
    </SidebarContainer>
  );
};

export default Sidebar;


