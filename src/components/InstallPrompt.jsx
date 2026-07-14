import React, { useEffect, useState } from 'react';
import { t } from '../i18n/translations';

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('app_installed') === '1') return;
    if (sessionStorage.getItem('install_hidden_this_session') === '1') return;

    const phoneOrTablet = window.matchMedia('(max-width: 1023px)').matches;

    if (isInstalled()) {
      markInstalled();
      return;
    }

    const displayMode = window.matchMedia('(display-mode: standalone)');

    function onPrompt(event) {
      event.preventDefault();
      if (!isInstalled() && phoneOrTablet) {
        setPromptEvent(event);
        setVisible(true);
        window.setTimeout(() => setVisible(false), 12000);
      }
    }

    function onInstalled() {
      markInstalled();
    }

    function onDisplayModeChange() {
      if (isInstalled()) {
        markInstalled();
      }
    }

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  async function install() {
    if (!promptEvent) {
      setVisible(false);
      return;
    }
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      markInstalled();
      return;
    }
    setPromptEvent(null);
    setVisible(false);
  }

  function dismiss() {
    sessionStorage.setItem('install_hidden_this_session', '1');
    setVisible(false);
  }

  function markInstalled() {
    localStorage.setItem('app_installed', '1');
    sessionStorage.removeItem('install_hidden_this_session');
    setPromptEvent(null);
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="install-banner">
      <span>{t('install.installPhone')}</span>
      <button type="button" onClick={install}>{t('install.install')}</button>
      <button type="button" onClick={dismiss}>{t('common.hide')}</button>
    </div>
  );
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

