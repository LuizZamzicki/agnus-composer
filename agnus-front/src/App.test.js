import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders the site header with a link to the catalog', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const linkElements = screen.getAllByText(/cat[aá]logo/i);
  expect(linkElements.length).toBeGreaterThan(0);
});
