import React from 'react';
import { t } from '../i18n/translations';

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-layer">
      <button aria-label={t('common.close')} className="modal-backdrop" onClick={onClose} type="button" />
      <section aria-modal="true" className="modal-sheet" role="dialog">
        <div className="modal-header">
          <h2>{title}</h2>
          <button aria-label={t('common.close')} className="modal-close icon-only" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
