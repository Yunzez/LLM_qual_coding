import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectsPage from '../app/projects/page';

describe('ProjectsPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders and allows creating a project', async () => {
    (global.fetch as jest.Mock) = jest
      .fn()
      // initial GET /projects
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      // POST /projects
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'p1', name: 'New Project', createdAt: new Date().toISOString() })
      } as Response)
      // GET /projects after creation
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'p1', name: 'New Project', createdAt: new Date().toISOString() }]
      } as Response);

    render(<ProjectsPage />);

    fireEvent.change(screen.getByPlaceholderText(/Spring 2025/i), {
      target: { value: 'New Project' }
    });

    fireEvent.click(screen.getByText(/Create project/i));

    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });
  });
});

