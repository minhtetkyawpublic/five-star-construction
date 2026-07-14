import React, { useEffect, useState } from 'react';
import { t } from '../i18n/translations';

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [manualHelp, setManualHelp] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('app_installed') === '1') return;
    if (sessionStorage.getItem('install_hidden_this_session') === '1') return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const phoneOrTablet = window.matchMedia('(max-width: 1023px)').matches;

    if (!standalone && phoneOrTablet) {
      const fallbackTimer = window.setTimeout(() => {
        setVisible(true);
        window.setTimeout(() => setVisible(false), 12000);
      }, 1800);

      return () => window.clearTimeout(fallbackTimer);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('app_installed') === '1') return;
    if (sessionStorage.getItem('install_hidden_this_session') === '1') return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const phoneOrTablet = window.matchMedia('(max-width: 1023px)');

    function onPrompt(event) {
      event.preventDefault();
      if (!standalone && phoneOrTablet.matches) {
        setPromptEvent(event);
        setCanPrompt(true);
        setVisible(true);
        window.setTimeout(() => setVisible(false), 12000);
      }
    }

    function onInstalled() {
      setVisible(false);
      localStorage.setItem('app_installed', '1');
    }

    function onScreenChange(event) {
      if (!event.matches) setVisible(false);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    phoneOrTablet.addEventListener('change', onScreenChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      phoneOrTablet.removeEventListener('change', onScreenChange);
    };
  }, []);

  async function install() {
    if (!promptEvent) {
      setManualHelp(true);
      return;
    }
    promptEvent.prompt();
    await promptEvent.userChoice;
    setVisible(false);
  }
  function dismiss() {
    sessionStorage.setItem('install_hidden_this_session', '1');
    setVisible(false);
  }
  if (!visible) return null;
  return (
    <div className="install-banner">
      <span>{manualHelp ? t('install.manualHelp') : canPrompt ? t('install.installPhone') : t('install.addHome')}</span>
      <button type="button" onClick={install}>{t('install.install')}</button>
      <button type="button" onClick={dismiss}>{t('common.hide')}</button>
    </div>
  );
}

