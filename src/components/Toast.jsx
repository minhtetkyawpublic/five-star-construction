import React, { useEffect, useState } from 'react';

export function showToast(message, type = 'success') {
  window.dispatchEvent(
    new CustomEvent('five-star-toast', {
      detail: { id: Date.now() + Math.random(), message, type },
    }),
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function onToast(event) {
      const toast = event.detail;
      setToasts((current) => [toast, ...current].slice(0, 4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 2600);
    }

    window.addEventListener('five-star-toast', onToast);
    return () => window.removeEventListener('five-star-toast', onToast);
  }, []);

  function dismiss(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  return (
    <div className="toast-viewport">
      {toasts.map((toast) => (
        <button className={`toast ${toast.type}`} key={toast.id} onClick={() => dismiss(toast.id)} type="button">
          <span>{toast.message}</span>
          <strong>Hide</strong>
        </button>
      ))}
    </div>
  );
}
