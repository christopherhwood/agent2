// SidebarStyles.js
import styled, { css } from 'styled-components';

export const SidebarContainer = styled.div`
  width: 250px; // Adjust width as necessary
  background-color: #f4f4f4; // Adjust the color as necessary
  height: 100vh;
  overflow-y: auto;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
`;

export const SidebarItem = styled.div`
  padding: 10px;
  margin-bottom: 5px;
  cursor: pointer;
  border-radius: 5px;
  &:hover {
    background-color: #e8e8e8;
  }
  display: flex;
  align-items: center;
`;

export const SidebarTitle = styled.h1`
  font-size: 1.5em;
  margin-bottom: 20px;
`;

export const StatusIndicator = styled.span`
  height: 10px;
  width: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 10px;

  ${(props) =>
    props.status === 'ready' &&
    css`
      background-color: green;
    `}
  ${(props) =>
    props.status === 'inProcess' &&
    css`
      background-color: yellow;
    `}
  ${(props) =>
    props.status === 'error' &&
    css`
      background-color: red;
    `}
`;