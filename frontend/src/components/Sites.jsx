import React, { useEffect, useState } from 'react';
import { siteInchargesApi, sitesApi, workersApi } from '../api/client';
import { SiteAttendance } from './Attendance';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function OwnerSites() {
  const [sites, setSites] = useState([]);
  const [incharges, setIncharges] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteForm, setSiteForm] = useState(emptySiteForm());
  const [assignedIds, setAssignedIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadOwnerData();
  }, []);

  async function loadOwnerData() {
    setLoading(true);
    setError('');

    try {
      const [siteList, inchargeList] = await Promise.all([sitesApi.list(), siteInchargesApi.list()]);
      setSites(siteList);
      setIncharges(inchargeList);
      if (selectedSite) {
        const freshSite = siteList.find((site) => site.id === selectedSite.id);
        setSelectedSite(freshSite || null);
      }
    } catch (loadError) {
      setError(loadError.message || t('sites.unableLoad'));
    } finally {
      setLoading(false);
    }
  }

  function selectSite(site) {
    setSelectedSite(site);
    setSiteForm({
      name: site.name,
      location: site.location,
      status: site.status === 'active' ? 'active' : 'completed',
    });
    setAssignedIds(site.incharges.map((incharge) => incharge.id));
    setMessage('');
    setError('');
  }

  function resetSiteForm() {
    setSelectedSite(null);
    setSiteForm(emptySiteForm());
    setAssignedIds([]);
    setMessage('');
    setError('');
    setModal('site');
  }

  function editSite(site) {
    selectSite(site);
    setModal('site');
  }

  function assignSite(site) {
    selectSite(site);
    setModal('assign');
  }

  function confirmDeleteSite(site) {
    selectSite(site);
    setModal('delete');
  }

  async function saveSite(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const savedSite = selectedSite
        ? await sitesApi.update(selectedSite.id, siteForm)
        : await sitesApi.create(siteForm);

      setMessage(selectedSite ? t('sites.updated') : t('sites.created'));
      showToast(selectedSite ? t('sites.updated') : t('sites.created'));
      await loadOwnerData();
      selectSite(savedSite);
      setModal(null);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save site.');
    }
  }

  async function saveAssignments() {
    if (!selectedSite) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const updatedSite = await sitesApi.assignIncharges(selectedSite.id, assignedIds);
      setMessage(t('sites.assignmentsUpdated'));
      showToast(t('sites.assignmentsUpdated'));
      await loadOwnerData();
      selectSite(updatedSite);
      setModal(null);
    } catch (assignError) {
      setError(assignError.message || 'Unable to assign site in-charges.');
    }
  }

  async function deleteSelectedSite() {
    if (!selectedSite) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const deletedSite = await sitesApi.delete(selectedSite.id);
      setSelectedSite(null);
      setAssignedIds([]);
      setSiteForm(emptySiteForm());
      setMessage(t('sites.deleted', { name: deletedSite.name }));
      showToast(t('sites.deleted', { name: deletedSite.name }));
      setModal(null);
      await loadOwnerData();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete site.');
    }
  }

  const filteredSites = statusFilter === 'all'
    ? sites
    : sites.filter((site) => (statusFilter === 'completed' ? site.status !== 'active' : site.status === 'active'));
  const availableIncharges = selectedSite
    ? incharges.filter((incharge) => !incharge.assigned_site_id || Number(incharge.assigned_site_id) === Number(selectedSite.id))
    : incharges.filter((incharge) => !incharge.assigned_site_id);

  return (
    <div className="dashboard-body">
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">{t('sites.loading')}</p>}

      <section className="panel">
        <div className="section-header sites-main-action">
          <button className="new-button full-width-action" onClick={resetSiteForm} type="button">
            <span aria-hidden="true">+</span>
            {t('common.new')}
          </button>
        </div>

        <div className="sub-tabs site-status-tabs">
          {['active', 'completed', 'all'].map((status) => (
            <button
              className={statusFilter === status ? 'active' : ''}
              key={status}
              onClick={() => setStatusFilter(status)}
              type="button"
            >
              {siteFilterLabel(status)}
            </button>
          ))}
        </div>

        <VisibleList
          items={filteredSites}
          loading={loading}
          emptyText={t('sites.noSites')}
          renderItem={(site) => (
            <div
              className={`site-card ${selectedSite?.id === site.id ? 'selected' : ''}`}
              key={site.id}
              onClick={() => selectSite(site)}
            >
              <span>{site.name}</span>
              <small>{site.location || t('common.noLocation')}</small>
              <small>
                {t('sites.inchargeLabel')}:{' '}
                {site.incharges.length > 0
                  ? site.incharges.map((incharge) => incharge.name).join(', ')
                  : t('sites.notAssigned')}
              </small>
              <span className="inline-actions">
                <button onClick={(event) => { event.stopPropagation(); editSite(site); }} type="button">{t('common.edit')}</button>
                <button onClick={(event) => { event.stopPropagation(); assignSite(site); }} type="button">{t('sites.assignIncharge')}</button>
                <button
                  className="danger-inline-button"
                  onClick={(event) => { event.stopPropagation(); confirmDeleteSite(site); }}
                  type="button"
                >
                  {t('common.delete')}
                </button>
              </span>
            </div>
          )}
        />
      </section>

      {modal === 'site' && (
        <Modal title={selectedSite ? t('sites.edit') : t('sites.create')} onClose={() => setModal(null)}>
        <form className="login-form compact-form" onSubmit={saveSite}>
          <label>
            {t('sites.name')}
            <input
              onChange={(event) => setSiteForm({ ...siteForm, name: event.target.value })}
              required
              type="text"
              value={siteForm.name}
            />
          </label>
          <label>
            {t('sites.location')}
            <input
              onChange={(event) => setSiteForm({ ...siteForm, location: event.target.value })}
              type="text"
              value={siteForm.location}
            />
          </label>
          <label>
            {t('sites.progress')}
            <select
              onChange={(event) => setSiteForm({ ...siteForm, status: event.target.value })}
              value={siteForm.status}
            >
              <option value="active">{t('sites.filterCurrent')}</option>
              <option value="completed">{t('common.completed')}</option>
            </select>
          </label>
          <button type="submit">{selectedSite ? t('common.saveChanges') : t('sites.createButton')}</button>
        </form>
        </Modal>
      )}

      {modal === 'assign' && selectedSite && (
        <Modal title={t('sites.assignInchargeTitle')} onClose={() => setModal(null)}>
          <div className="checkbox-list">
            {availableIncharges.length === 0 && <p className="empty-state">{t('users.noUsers')}</p>}
            {availableIncharges.map((incharge) => (
              <label className="check-row" key={incharge.id}>
                <input
                  checked={assignedIds[0] === incharge.id}
                  name="site-incharge"
                  onChange={() => setAssignedIds([incharge.id])}
                  type="radio"
                />
                <span>
                  <strong>{incharge.name}</strong>
                  <small>{incharge.phone}</small>
                </span>
              </label>
            ))}
          </div>
          <button className="primary-button" onClick={saveAssignments} type="button">
            {t('sites.saveAssignments')}
          </button>
        </Modal>
      )}

      {modal === 'delete' && selectedSite && (
        <Modal title={t('sites.deleteTitle')} onClose={() => setModal(null)}>
          <p className="intro">
            {t('sites.deleteConfirm')}
          </p>
          <button className="danger-button" onClick={deleteSelectedSite} type="button">
            {t('sites.deleteButton')}
          </button>
        </Modal>
      )}

    </div>
  );
}

export function AssignedSites() {
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteWorkers, setSiteWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAssignedSite();
  }, []);

  async function loadAssignedSite() {
    setLoading(true);
    setError('');

    try {
      const sites = await sitesApi.list();
      const site = sites[0];
      if (!site) {
        setSelectedSite(null);
        setSiteWorkers([]);
        return;
      }

      const [freshSite, workers] = await Promise.all([sitesApi.get(site.id), workersApi.listForSite(site.id)]);
      setSelectedSite(freshSite);
      setSiteWorkers(workers);
    } catch (siteError) {
      setError(siteError.message || 'Unable to open site.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-body">
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">{t('sites.loading')}</p>}

      {selectedSite && (
        <section className="panel">
          <h2>{selectedSite.name}</h2>
          <div className="info-grid">
            <div className="info-cell">
              <span>{t('sites.location')}</span>
              <strong>{selectedSite.location || t('common.noLocation')}</strong>
            </div>
          </div>

          <SiteAttendance site={selectedSite} workers={siteWorkers} />
        </section>
      )}

      {!loading && !selectedSite && (
        <section className="panel">
          <p className="empty-state">{t('sites.noActiveAssigned')}</p>
        </section>
      )}
    </div>
  );
}

function emptySiteForm() {
  return {
    name: '',
    location: '',
    status: 'active',
  };
}

function siteFilterLabel(status) {
  const labels = {
    active: t('sites.filterCurrent'),
    completed: t('sites.filterCompleted'),
    all: t('sites.filterAll'),
  };
  return labels[status] || status;
}

