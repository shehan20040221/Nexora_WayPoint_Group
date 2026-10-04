import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './ui/Toast';
import { USE_FIXTURES } from './api/client';
import './index.css';

async function boot() {
  if (USE_FIXTURES) {
    // Registers auth fixtures plus every roles/*/fixtures.ts (each person owns their own).
    await import('./api/fixtures-auth');
    const mods = import.meta.glob('./roles/*/fixtures.ts');
    await Promise.all(Object.values(mods).map((m) => m()));
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
boot();
