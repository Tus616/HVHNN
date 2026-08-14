import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  ConfirmationDialog,
  DateTimeInput,
  DropdownMenu,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  LocationSummary,
  Modal,
  Pagination,
  PermissionDeniedState,
  RadioGroup,
  SearchInput,
  StatCard,
  Switch,
  Tabs,
  Tooltip,
  UserSummary,
} from './ui';

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Phase 7 UI system', () => {
  it('renders button variants, loading and disabled states', () => {
    renderWithRouter(
      <>
        <Button variant="primary">Save</Button>
        <Button variant="secondary" loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </>
    );
    expect(screen.getByRole('button', { name: /save/i })).toHaveClass('ui-button--primary');
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled();
  });

  it('connects form labels and field errors', () => {
    render(<FormField label="Full name" error="Required"><Input id="full-name" /></FormField>);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('gives icon buttons an accessible name', () => {
    render(<IconButton label="Open notifications">N</IconButton>);
    expect(screen.getByRole('button', { name: 'Open notifications' })).toBeInTheDocument();
  });

  it('uses text in status badges instead of color only', () => {
    render(<Badge variant="danger">Critical</Badge>);
    expect(screen.getByText('Critical')).toBeVisible();
  });

  it('renders empty and error states with actions', () => {
    const retry = vi.fn();
    renderWithRouter(
      <>
        <EmptyState title="Nothing here" message="Try again later" actionLabel="Create" actionTo="/create" />
        <ErrorState message="Could not load" onRetry={retry} />
      </>
    );
    expect(screen.getByRole('link', { name: /create/i })).toHaveAttribute('href', '/create');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalled();
  });

  it('supports switch interaction', () => {
    const onChange = vi.fn();
    render(<Switch label="Push notifications" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /push notifications/i }));
    expect(onChange).toHaveBeenCalled();
  });

  it('renders accessible tabs', () => {
    render(<Tabs active="one" onChange={() => {}} tabs={[{ id: 'one', label: 'One', content: <p>Panel one</p> }]} />);
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel one');
  });

  it('closes modal with Escape and returns focus behaviour hooks', () => {
    const onClose = vi.fn();
    render(<Modal open title="Confirm action" onClose={onClose}><p>Body</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('uses alert semantics for dangerous feedback', () => {
    render(<Alert variant="danger" title="Failed">Try again</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('renders additional Phase 7 form and summary primitives accessibly', () => {
    const onChange = vi.fn();
    renderWithRouter(
      <>
        <RadioGroup label="Location source" name="locationSource" value="profile" onChange={onChange} options={[{ value: 'manual', label: 'Manual' }]} />
        <SearchInput aria-label="Search requests" />
        <DateTimeInput aria-label="Needed by" />
        <Avatar name="Asha Rao" />
        <StatCard label="Open" value="12" hint="requests" />
        <Tooltip label="More info"><button type="button">Info</button></Tooltip>
        <DropdownMenu label="Actions"><button type="button">Archive</button></DropdownMenu>
        <Pagination page={0} hasMore onPrevious={() => {}} onNext={() => {}} />
        <Breadcrumb items={[{ label: 'Feed', to: '/feed' }, { label: 'Request' }]} />
        <UserSummary user={{ name: 'Asha Rao', role: 'COMMUNITY_ADMIN' }} />
        <LocationSummary location={{ city: 'Pune' }} />
        <PermissionDeniedState />
      </>
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Manual' }));
    expect(onChange).toHaveBeenCalledWith('manual');
    expect(screen.getByRole('searchbox', { name: /search requests/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/needed by/i)).toHaveAttribute('type', 'datetime-local');
    expect(screen.getAllByLabelText('Asha Rao').length).toBeGreaterThan(0);
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Info' })).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Page 1');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Feed');
    expect(screen.getAllByText('Asha Rao').length).toBeGreaterThan(0);
    expect(screen.getByText('Pune')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
  });

  it('renders confirmation dialog actions', () => {
    const onConfirm = vi.fn();
    render(<ConfirmationDialog open destructive title="Delete item" message="This cannot be undone." onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
