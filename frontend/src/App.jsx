import React, { useEffect, useState } from 'react';
import { authApi, clearAuthToken, getAuthToken } from './api/client';
import { LoginScreen } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { InstallPrompt } from './components/InstallPrompt';
import { ToastViewport } from './components/Toast';
import { t } from './i18n/translations';
import './styles.css';

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!getAuthToken()) {
      setCheckingSession(false);
      return;
    }

    authApi
      .me()
      .then(setUser)
      .catch((error) => {
        if (error.code === 'AUTH_REQUIRED') {
          clearAuthToken();
        }
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  if (checkingSession) {
    return (
      <>
        <main className="app-shell">
          <section className="phone-frame compact-frame">
            <div className="status-pill">{t('common.loading')}</div>
            <h1>{t('app.name')}</h1>
            <p className="intro">{t('common.loading')}...</p>
          </section>
        </main>
        <InstallPrompt />
        <ToastViewport />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={setUser} />
        <InstallPrompt />
        <ToastViewport />
      </>
    );
  }

  return (
    <>
      <Dashboard user={user} onLogout={() => setUser(null)} />
      <InstallPrompt />
      <ToastViewport />
    </>
  );
}

export default App;
