import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../app/settings/page';

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('loads and toggles AI settings', async () => {
    (global.fetch as jest.Mock) = jest
      .fn()
      // initial GET /settings
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'default', aiEnabled: false })
      } as Response)
      // PUT /settings
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'default', aiEnabled: true })
      } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Disabled/i)).toBeInTheDocument();
    });

    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/Enabled/i)).toBeInTheDocument();
    });
  });
});

