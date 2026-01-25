/**
 * Connection Status Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatus } from './connection-status';

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render connected status', () => {
    render(<ConnectionStatus status="connected" />);
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('should render disconnected status', () => {
    render(<ConnectionStatus status="disconnected" />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it('should render reconnecting status', () => {
    render(<ConnectionStatus status="reconnecting" />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });
});
