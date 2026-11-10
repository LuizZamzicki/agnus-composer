import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/marcellus/latin-400.css';
import '@fontsource/marcellus-sc/latin-400.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import './index.css';
import App from './App.tsx';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from './components/notification';
import { aplicarTempoLiturgico } from './utils/liturgia';
import { aplicarTemaSalvo } from './utils/tema';

aplicarTemaSalvo();
aplicarTempoLiturgico();

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <NotificationProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NotificationProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
