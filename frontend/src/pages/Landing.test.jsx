import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing';
import { ThemeProvider } from '../context/ThemeContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

function renderLanding() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Landing />
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('Landing page', () => {
  it('renders the approved sections and public auth links', () => {
    renderLanding();

    expect(screen.getByRole('heading', { name: /help\. connect\./i })).toBeInTheDocument();
    expect(screen.getByText(/make a difference/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /raise a request/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /i want to help/i })).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: /how it works/i })[0]).toHaveAttribute('href', '#how-it-works');
    expect(screen.getByText(/Sahay's intelligence layer is designed/i)).toBeInTheDocument();
    expect(screen.getByText(/This preview avoids dynamic member counts/i)).toBeInTheDocument();
  });

  it('persists theme changes through the shared theme provider', () => {
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('hvhn_theme')).toBe('dark');
  });

  it('shows the required hero asset path when the exact image is missing', () => {
    renderLanding();

    fireEvent.error(screen.getByAltText(/community volunteers/i));

    expect(screen.getByText('frontend/public/assets/sahay-landing-hero.png')).toBeInTheDocument();
  });
});
