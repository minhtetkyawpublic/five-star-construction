import React, { useState } from 'react';
import { authApi } from '../api/client';
import { t } from '../i18n/translations';

export function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedInUser = await authApi.login(phone, password);
      onLogin(loggedInUser);
    } catch (loginError) {
      setError(loginError.message || t('auth.unableLogin'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="phone-frame login-frame">
        <div className="status-pill">{t('auth.secureLogin')}</div>
        <h1>{t('app.name')}</h1>
        <p className="intro">{t('auth.intro')}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            {t('auth.phoneOrUsername')}
            <input
              autoComplete="username"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="owner"
              required
              type="text"
              value={phone}
            />
          </label>

          <label>
            {t('common.password')}
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('common.password')}
              required
              type="password"
              value={password}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button disabled={submitting} type="submit">
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>
      </section>
    </main>
  );
}
