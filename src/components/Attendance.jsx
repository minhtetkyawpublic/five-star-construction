import React, { useEffect, useState } from 'react';
import { attendanceApi, reportLockingApi } from '../api/client';
import { todayString } from '../utils/format';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function SiteAttendance({ site, workers }) {
  const [date, setDate] = useState(todayString());
  const [rows, setRows] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [editReason, setEditReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadAttendance();
  }, [site.id, date, workers]);

  async function loadAttendance() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const report = await attendanceApi.getForSiteDate(site.id, date);
      setCurrentReport(report);
      setLocked(false);
      const existingByWorker = new Map((report?.attendance || []).map((entry) => [entry.worker_id, entry]));
      setRows(
        workers.map((worker) => {
          const existing = existingByWorker.get(worker.id);
          return {
            worker_id: worker.id,
            worker_name: worker.name,
            status: existing?.status || 'absent',
            wage_amount: String(existing?.wage_amount ?? 0),
            note: existing?.note || '',
          };
        }),
      );
    } catch (loadError) {
      setError(loadError.message || 'Unable to load attendance.');
    } finally {
      setLoading(false);
    }
  }

  function updateRow(workerId, changes) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.worker_id === workerId ? { ...row, ...changes } : row)),
    );
  }

  async function saveAttendance(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await attendanceApi.save({
        site_id: site.id,
        report_date: date,
        attendance: rows.map((row) => ({
          worker_id: row.worker_id,
          status: row.status,
          wage_amount: 0,
          note: '',
        })),
      });
      setMessage(t('attendance.saved'));
      showToast(t('attendance.saved'));
      await loadAttendance();
      setModalOpen(false);
    } catch (saveError) {
      if (saveError.code === 'REPORT_LOCKED') {
        setLocked(true);
      }
      setError(saveError.message || 'Unable to save attendance.');
    }
  }

  async function requestEditAccess(event) {
    event.preventDefault();
    if (!currentReport) {
      setError('No existing report found for this date.');
      return;
    }
    try {
      await reportLockingApi.createEditRequest({
        daily_report_id: currentReport.id,
        reason: editReason,
      });
      setEditReason('');
      setMessage(t('attendance.editSent'));
      showToast(t('attendance.editSent'));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Unable to request edit access.');
    }
  }

  return (
    <div className="attendance-entry">
      <div className="attendance-toolbar">
        <div className="attendance-display-card">
          <span>{t('common.date')}</span>
          <strong>{date}</strong>
        </div>
        <div className="attendance-count">
          <span>{t('attendance.workers')}</span>
          <strong>{rows.length}</strong>
        </div>
        <button className="primary-button" onClick={() => setModalOpen(true)} type="button">
          {t('attendance.enter')}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">Loading attendance...</p>}

      {modalOpen && (
        <Modal title={t('attendance.enter')} onClose={() => setModalOpen(false)}>
      <form className="login-form compact-form" onSubmit={saveAttendance}>
        <label>
          {t('common.date')}
          <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>

        {error && <p className="form-error">{error}</p>}
        {locked && (
          <div className="lock-request">
            <input
              placeholder="Reason for late edit"
              value={editReason}
              onChange={(event) => setEditReason(event.target.value)}
            />
            <button type="button" onClick={requestEditAccess}>{t('attendance.requestEdit')}</button>
          </div>
        )}
        {loading && <p className="hint">Loading attendance...</p>}
        {rows.length === 0 && !loading && <p className="empty-state">Assign workers to this site first.</p>}

        <VisibleList
          items={rows}
          emptyText=""
          className="attendance-list"
          renderItem={(row) => (
            <div className="attendance-card" key={row.worker_id}>
              <strong>{row.worker_name}</strong>
              <div className="status-choice">
                <button
                  className={`present ${row.status === 'present' ? 'active' : ''}`}
                  onClick={() => updateRow(row.worker_id, { status: 'present' })}
                  type="button"
                >
                  {t('attendance.present')}
                </button>
                <button
                  className={`half-day ${row.status === 'half_day' ? 'active' : ''}`}
                  onClick={() => updateRow(row.worker_id, { status: 'half_day' })}
                  type="button"
                >
                  {t('attendance.halfDay')}
                </button>
                <button
                  className={`absent ${row.status === 'absent' ? 'active' : ''}`}
                  onClick={() => updateRow(row.worker_id, { status: 'absent' })}
                  type="button"
                >
                  {t('attendance.absent')}
                </button>
              </div>
            </div>
          )}
        />

        <button disabled={rows.length === 0} type="submit">{t('attendance.save')}</button>
      </form>
        </Modal>
      )}
    </div>
  );
}

