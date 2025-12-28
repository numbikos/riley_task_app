import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Auth from '../Auth';

// Helper to get password input since it doesn't have proper label association
const getPasswordInput = (container: HTMLElement): HTMLInputElement => {
  return container.querySelector('input[type="password"]') as HTMLInputElement;
};

// Use vi.hoisted() to ensure mocks are created before the factory runs
const { mockSignInWithPassword, mockSignUp } = vi.hoisted(() => {
  return {
    mockSignInWithPassword: vi.fn(),
    mockSignUp: vi.fn(),
  };
});

// Mock Supabase - path is relative to this test file location
vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
    },
  },
}));

describe('Auth', () => {
  const mockOnAuthSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockSignInWithPassword.mockReset();
    mockSignUp.mockReset();
  });
  
  it('should verify mock is set up correctly', () => {
    // Verify mocks are functions
    expect(typeof mockSignInWithPassword).toBe('function');
    expect(typeof mockSignUp).toBe('function');
    
    // Verify they're vi.fn() mocks
    expect(vi.isMockFunction(mockSignInWithPassword)).toBe(true);
    expect(vi.isMockFunction(mockSignUp)).toBe(true);
  });

  it('should render sign in form', () => {
    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    expect(screen.getByText('💩 Poop Task')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(getPasswordInput(container)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should render email and password inputs', () => {
    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox');
    const passwordInput = getPasswordInput(container);
    
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should update email input value', () => {
    render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    expect(emailInput.value).toBe('test@example.com');
  });

  it('should update password input value', () => {
    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const passwordInput = getPasswordInput(container);
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(passwordInput.value).toBe('password123');
  });

  it('should call signInWithPassword on form submit', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    const passwordInput = getPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Set values
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Click submit button (which should trigger form submission)
    fireEvent.click(submitButton);
    
    // Wait for async operation
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Verify it was called with correct arguments
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should call onAuthSuccess after successful sign in', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    const passwordInput = getPasswordInput(container);
    const form = container.querySelector('form') as HTMLFormElement;
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(mockOnAuthSuccess).toHaveBeenCalled();
    });
  });

  it('should display error message on sign in failure', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox');
    const passwordInput = getPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
    
    expect(mockOnAuthSuccess).not.toHaveBeenCalled();
  });

  it('should show loading state during sign in', async () => {
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise((resolve) => {
      resolveSignIn = resolve;
    });
    mockSignInWithPassword.mockReturnValue(signInPromise);

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox');
    const passwordInput = getPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
    
    expect(submitButton).toBeDisabled();
    
    resolveSignIn!({ error: null });
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should disable inputs during loading', async () => {
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise((resolve) => {
      resolveSignIn = resolve;
    });
    mockSignInWithPassword.mockReturnValue(signInPromise);

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox');
    const passwordInput = getPasswordInput(container);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });
    
    // Wrap in act() to properly handle the state update when promise resolves
    await act(async () => {
      resolveSignIn!({ error: null });
    });
  });

  it('should handle unexpected errors', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Network error'));

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    const passwordInput = getPasswordInput(container);
    const form = container.querySelector('form') as HTMLFormElement;
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should require email and password', () => {
    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox');
    const passwordInput = getPasswordInput(container);
    
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('should enforce minimum password length', () => {
    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const passwordInput = getPasswordInput(container);
    expect(passwordInput).toHaveAttribute('minLength', '6');
  });

  it('should clear error message on new submission', async () => {
    mockSignInWithPassword
      .mockResolvedValueOnce({
        error: { message: 'First error' },
      })
      .mockResolvedValueOnce({
        error: null,
      });

    const { container } = render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const emailInput = screen.getByRole('textbox') as HTMLInputElement;
    const passwordInput = getPasswordInput(container);
    const form = container.querySelector('form') as HTMLFormElement;
    
    // First submission with error
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });
    
    // Second submission should clear error
    fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });
  });
});

