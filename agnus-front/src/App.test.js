import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders the site header with a link to the collection', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  const links = screen.getAllByRole('link', { name: /coleção/i });
  expect(links.some((link) => link.getAttribute('href') === '/catalogo')).toBe(true);
});

test('shows the current liturgical season in the header', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
  expect(document.querySelector('.season-strip')).toHaveTextContent(/Tempo|Advento|Quaresma|Pentecostes/);
});
