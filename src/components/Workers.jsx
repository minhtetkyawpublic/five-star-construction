import React, { useEffect, useState } from 'react';
import { sitesApi, workerPaymentsApi, workersApi } from '../api/client';
import { t } from '../i18n/translations';
import { formatMoney, monthString, todayString } from '../utils/format';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';

export function OwnerWorkers() {
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [modalWorker, setModalWorker] = useState(null);
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm());
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('current');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkerData();
  }, []);

  async function loadWorkerData() {
    setLoading(true);
    setError('');

    try {
      const [siteList, workerList] = await Promise.all([sitesApi.list(), workersApi.list()]);
      setSites(siteList);
      setWorkers(workerList);
      if (selectedWorker) {
        const freshWorker = workerList.find((worker) => worker.id === selectedWorker.id);
        setSelectedWorker(freshWorker || null);
      }
    } catch (loadError) {
      setError(loadError.message || t('workers.loadingData'));
    } finally {
      setLoading(false);
    }
  }

  function selectWorker(worker) {
    setSelectedWorker(worker);
    setWorkerForm({
      name: worker.name,
      phone: worker.phone,
      daily_wage: String(worker.daily_wage),
      status: worker.status,
    });
    setError('');
  }

  function editWorker(worker) {
    setModalWorker(worker);
    setWorkerForm({
      name: worker.name,
      phone: worker.phone,
      daily_wage: String(worker.daily_wage),
      status: worker.status,
    });
    setModal('worker');
  }

  function confirmDeleteWorker(worker) {
    setModalWorker(worker);
    setWorkerForm({
      name: worker.name,
      phone: worker.phone,
      daily_wage: String(worker.daily_wage),
      status: worker.status,
    });
    setModal('delete');
  }

  async function saveWorker(event) {
    event.preventDefault();
    setError('');

    if (!modalWorker) {
      return;
    }

    try {
      const payload = {
        ...workerForm,
        daily_wage: Number(workerForm.daily_wage || 0),
      };
      const savedWorker = await workersApi.update(modalWorker.id, payload);

      showToast(modalWorker ? t('workers.updated') : t('workers.created'));
      await loadWorkerData();
      if (selectedWorker?.id === savedWorker.id) {
        setSelectedWorker(savedWorker);
      }
      setModalWorker(null);
      setModal(null);
    } catch (saveError) {
      setError(saveError.message || t('workers.loadingData'));
    }
  }

  async function deleteSelectedWorker() {
    if (!modalWorker) return;
    setError('');

    try {
      const deletedWorker = await workersApi.delete(modalWorker.id);
      if (selectedWorker?.id === modalWorker.id) {
        setSelectedWorker(null);
      }
      setModalWorker(null);
      setWorkerForm(emptyWorkerForm());
      showToast(t('workers.deleted', { name: deletedWorker.name }));
      setModal(null);
      await loadWorkerData();
    } catch (deleteError) {
      setError(deleteError.message || t('workers.loadingData'));
    }
  }

  const statusFilteredWorkers = workers.filter((worker) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'completed') return worker.sites.some((site) => site.status !== 'active');
    return worker.sites.some((site) => site.status === 'active');
  });

  const filteredWorkers = siteFilter
    ? statusFilteredWorkers.filter((worker) => worker.sites.some((site) => String(site.id) === String(siteFilter)))
    : statusFilteredWorkers;
  const filteredSiteOptions = statusFilter === 'all'
    ? sites
    : sites.filter((site) => (statusFilter === 'completed' ? site.status !== 'active' : site.status === 'active'));

  function chooseStatusFilter(status) {
    setStatusFilter(status);
    setSiteFilter('');
  }

  if (selectedWorker && !modal) {
    return (
      <WorkerDetail
        worker={selectedWorker}
        showFinancials
        onBack={() => setSelectedWorker(null)}
        onChanged={loadWorkerData}
      />
    );
  }

  return (
    <div className="dashboard-body">
      <section className="panel">
        <div className="sub-tabs site-status-tabs">
          {['current', 'completed', 'all'].map((status) => (
            <button
              className={statusFilter === status ? 'active' : ''}
              key={status}
              onClick={() => chooseStatusFilter(status)}
              type="button"
            >
              {workerFilterLabel(status)}
            </button>
          ))}
        </div>

        <WorkerSiteFilter
          id="owner-worker-site-filter"
          label={t('workers.siteFilter')}
          options={filteredSiteOptions}
          value={siteFilter}
          allText={t('common.allSites')}
          onChange={setSiteFilter}
        />

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="hint">{t('workers.loadingData')}</p>}

        <VisibleList
          items={filteredWorkers}
          loading={loading}
          emptyText={t('workers.noWorkers')}
          renderItem={(worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              showWage={false}
              selected={selectedWorker?.id === worker.id}
              onSelect={() => selectWorker(worker)}
              actions={
                <>
                  <button onClick={(event) => { event.stopPropagation(); editWorker(worker); }} type="button">
                    {t('common.edit')}
                  </button>
                  <button
                    className="danger-inline-button"
                    onClick={(event) => { event.stopPropagation(); confirmDeleteWorker(worker); }}
                    type="button"
                  >
                    {t('common.delete')}
                  </button>
                </>
              }
            />
          )}
        />
      </section>

      {modal === 'worker' && (
        <WorkerFormModal
          title={modalWorker ? t('workers.edit') : t('workers.create')}
          workerForm={workerForm}
          setWorkerForm={setWorkerForm}
          selectedWorker={modalWorker}
          onClose={() => { setModal(null); setModalWorker(null); }}
          onSubmit={saveWorker}
        />
      )}

      {modal === 'delete' && modalWorker && (
        <Modal title={t('workers.deleteTitle')} onClose={() => { setModal(null); setModalWorker(null); }}>
          <p className="intro">{t('workers.deleteConfirm')}</p>
          <button className="danger-button" onClick={deleteSelectedWorker} type="button">
            {t('workers.deleteButton')}
          </button>
        </Modal>
      )}
    </div>
  );
}

export function SiteInchargeWorkers() {
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [modalWorker, setModalWorker] = useState(null);
  const [workerForm, setWorkerForm] = useState(emptyWorkerForm());
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkerData();
  }, []);

  async function loadWorkerData() {
    setLoading(true);
    setError('');

    try {
      const [siteList, workerList] = await Promise.all([sitesApi.list(), workersApi.list()]);
      setSites(siteList);
      setWorkers(workerList);
      if (selectedWorker) {
        const freshWorker = workerList.find((worker) => worker.id === selectedWorker.id);
        setSelectedWorker(freshWorker || null);
      }
    } catch (loadError) {
      setError(loadError.message || t('workers.loading'));
    } finally {
      setLoading(false);
    }
  }

  function newWorker() {
    if (sites.length === 0) {
      setError(t('sites.noAssigned'));
      return;
    }

    setModalWorker(null);
    setWorkerForm({
      ...emptyWorkerForm(),
      site_id: sites[0]?.id ? String(sites[0].id) : '',
    });
    setError('');
    setModal('worker');
  }

  function editWorker(worker) {
    setModalWorker(worker);
    setWorkerForm({
      name: worker.name,
      phone: worker.phone,
      daily_wage: String(worker.daily_wage),
      status: worker.status,
      site_id: worker.sites[0]?.id ? String(worker.sites[0].id) : sites[0]?.id ? String(sites[0].id) : '',
    });
    setError('');
    setModal('worker');
  }

  async function saveWorker(event) {
    event.preventDefault();
    setError('');

    try {
      const payload = {
        name: workerForm.name,
        phone: workerForm.phone,
        site_id: workerForm.site_id,
      };
      const savedWorker = modalWorker
        ? await workersApi.update(modalWorker.id, payload)
        : await workersApi.create(payload);

      if (selectedWorker?.id === savedWorker.id) {
        setSelectedWorker(savedWorker);
      }
      showToast(modalWorker ? t('workers.updated') : t('workers.created'));
      await loadWorkerData();
      setModalWorker(null);
      setModal(null);
    } catch (saveError) {
      setError(saveError.message || t('workers.loading'));
    }
  }

  if (selectedWorker && !modal) {
    return (
      <WorkerDetail
        worker={selectedWorker}
        showFinancials={false}
        onBack={() => setSelectedWorker(null)}
      />
    );
  }

  return (
    <div className="dashboard-body">
      <section className="panel">
        <div className="section-header sites-main-action">
          <button className="new-button full-width-action" disabled={sites.length === 0} onClick={newWorker} type="button">
            <span aria-hidden="true">+</span>
            {t('common.new')}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="hint">{t('workers.loading')}</p>}

        <VisibleList
          items={workers}
          loading={loading}
          emptyText={t('workers.noAssignedWorkers')}
          renderItem={(worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              showWage={false}
              selected={selectedWorker?.id === worker.id}
              onSelect={() => setSelectedWorker(worker)}
              actions={<button onClick={(event) => { event.stopPropagation(); editWorker(worker); }} type="button">{t('common.edit')}</button>}
            />
          )}
        />
      </section>

      {modal === 'worker' && (
        <WorkerFormModal
          title={modalWorker ? t('workers.edit') : t('workers.create')}
          workerForm={workerForm}
          setWorkerForm={setWorkerForm}
          selectedWorker={modalWorker}
          showFinancialFields={false}
          onClose={() => { setModal(null); setModalWorker(null); }}
          onSubmit={saveWorker}
        />
      )}
    </div>
  );
}

function WorkerCard({ worker, selected = false, actions, onSelect, showWage = true }) {
  return (
    <div className={`site-card ${selected ? 'selected' : ''}`} onClick={onSelect} role={onSelect ? 'button' : undefined}>
      <span>{worker.name}</span>
      {showWage && <small>{formatMoney(worker.daily_wage)} / {t('workers.perDay')}</small>}
      <small>{worker.sites.map((site) => site.name).join(', ') || t('workers.noSite')}</small>
      <span className="inline-actions" onClick={(event) => event.stopPropagation()}>{actions}</span>
    </div>
  );
}

function WorkerSiteFilter({ id, label, options, value, allText, onChange }) {
  return (
    <div className="filter-row">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allText}</option>
        {options.map((site) => (
          <option key={site.id} value={site.id}>{site.name}</option>
        ))}
      </select>
    </div>
  );
}

function workerFilterLabel(status) {
  const labels = {
    current: t('sites.filterCurrent'),
    completed: t('sites.filterCompleted'),
    all: t('sites.filterAll'),
  };
  return labels[status] || status;
}

function attendanceStatusLabel(status) {
  const labels = {
    present: t('attendance.present'),
    absent: t('attendance.absent'),
    half_day: t('attendance.halfDay'),
  };
  return labels[status] || status;
}

function WorkerDetail({ worker, showFinancials, onBack, onChanged }) {
  const [month, setMonth] = useState(monthString());
  const [attendance, setAttendance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm(worker));
  const [paymentModal, setPaymentModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkerDetail();
    setPaymentForm(emptyPaymentForm(worker));
  }, [worker.id, month]);

  async function loadWorkerDetail() {
    setLoading(true);
    setError('');

    try {
      const attendanceRows = await workersApi.attendance(worker.id, month);
      setAttendance(attendanceRows);

      if (showFinancials) {
        setPayments(await workerPaymentsApi.listForWorker(worker.id));
      } else {
        setPayments([]);
      }
    } catch (loadError) {
      setError(loadError.message || t('workers.loadingData'));
    } finally {
      setLoading(false);
    }
  }

  const attendanceDays = attendance.reduce((total, entry) => {
    if (entry.status === 'present') return total + 1;
    if (entry.status === 'half_day') return total + 0.5;
    return total;
  }, 0);
  const monthlyAdvances = payments.filter(
    (payment) => payment.type === 'advance' && payment.payment_date?.startsWith(month),
  );
  const monthlyWagePayments = payments.filter(
    (payment) => payment.type === 'wage_payment' && payment.payment_date?.startsWith(month),
  );
  const monthlyAdvanceTotal = monthlyAdvances.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const monthlyPaidTotal = monthlyWagePayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const earnedWageTotal = Number(worker.daily_wage || 0) * attendanceDays;
  const remainingPayable = earnedWageTotal - monthlyAdvanceTotal - monthlyPaidTotal;

  function openPaymentModal(type) {
    setPaymentForm({
      ...emptyPaymentForm(worker),
      type,
    });
    setError('');
    setPaymentModal(type);
  }

  async function savePayment(event) {
    event.preventDefault();
    setError('');

    try {
      await workerPaymentsApi.create({
        site_id: Number(paymentForm.site_id),
        worker_id: worker.id,
        payment_date: paymentForm.payment_date,
        type: paymentForm.type,
        amount: Number(paymentForm.amount || 0),
        note: paymentForm.note,
      });
      showToast(t('payments.recorded'));
      setPaymentModal(null);
      await loadWorkerDetail();
      onChanged?.();
    } catch (saveError) {
      setError(saveError.message || t('payments.recordPayment'));
    }
  }

  return (
    <div className="dashboard-body">
    <section className="panel">
      <div className="section-header">
        <button className="ghost-button" onClick={onBack} type="button">{t('common.back')}</button>
      </div>
      <h2>{t('workers.detailTitle')}</h2>
      <div className="info-grid">
        <div className="info-cell">
          <span>{t('workers.name')}</span>
          <strong>{worker.name}</strong>
        </div>
        <div className="info-cell">
          <span>{t('common.phone')}</span>
          <strong>{worker.phone || '-'}</strong>
        </div>
        {showFinancials && (
          <div className="info-cell">
            <span>{t('workers.dailyWage')}</span>
            <strong>{formatMoney(worker.daily_wage)}</strong>
          </div>
        )}
        {showFinancials && (
          <>
            <div className="info-cell">
              <span>{t('workers.attendanceDays')}</span>
              <strong>{attendanceDays}</strong>
            </div>
            <div className="info-cell">
              <span>{t('workers.earnedWage')}</span>
              <strong>{formatMoney(earnedWageTotal)}</strong>
            </div>
            <div className="info-cell">
              <span>{t('workers.upfrontMoney')}</span>
              <strong>{formatMoney(monthlyAdvanceTotal)}</strong>
            </div>
            <div className="info-cell">
              <span>{t('workers.wagePaid')}</span>
              <strong>{formatMoney(monthlyPaidTotal)}</strong>
            </div>
            <div className="info-cell">
              <span>{t('workers.remainingPayable')}</span>
              <strong>{formatMoney(remainingPayable)}</strong>
            </div>
          </>
        )}
        <div className={`info-cell ${showFinancials ? '' : 'wide'}`}>
          <span>{t('common.site')}</span>
          <strong>{worker.sites.map((site) => site.name).join(', ') || t('workers.noSite')}</strong>
        </div>
      </div>

      <div className="filter-row">
        <label htmlFor={`worker-attendance-month-${worker.id}`}>{t('workers.attendanceMonth')}</label>
        <input
          id={`worker-attendance-month-${worker.id}`}
          onChange={(event) => setMonth(event.target.value)}
          type="month"
          value={month}
        />
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">{t('common.loading')}...</p>}

      <h3>{t('workers.attendanceHistory')}</h3>
      <VisibleList
        items={attendance}
        loading={loading}
        emptyText={t('workers.noAttendance')}
        renderItem={(entry) => (
          <div className="site-card read-only-card" key={`${entry.site_id}-${entry.date}`}>
            <span>{entry.date}</span>
            <small>{entry.site_name} - <span className={`attendance-status ${entry.status}`}>{attendanceStatusLabel(entry.status)}</span></small>
            {entry.note && <small>{entry.note}</small>}
          </div>
        )}
      />

      {showFinancials && (
        <>
          <h3>{t('workers.paymentHistory')}</h3>
          <div className="action-row">
            <button className="ghost-button" onClick={() => openPaymentModal('advance')} type="button">
              {t('workers.recordAdvance')}
            </button>
            <button className="ghost-button" onClick={() => openPaymentModal('wage_payment')} type="button">
              {t('workers.recordPayment')}
            </button>
          </div>
          {monthlyAdvances.length > 0 && (
            <p className="hint">{t('workers.upfrontMoney')}: {formatMoney(monthlyAdvanceTotal)}</p>
          )}
          <VisibleList
            items={payments}
            loading={loading}
            emptyText={t('payments.noPayments')}
            renderItem={(payment) => (
              <div className="site-card read-only-card" key={payment.id}>
                <span>{payment.type === 'advance' ? t('workers.upfrontMoney') : t('payments.wagePayment')}</span>
                <small>{payment.site_name} - {payment.payment_date}</small>
                <small>{formatMoney(payment.amount)}</small>
                {payment.note && <small>{payment.note}</small>}
              </div>
            )}
          />
        </>
      )}

      {paymentModal && (
        <Modal title={paymentForm.type === 'advance' ? t('workers.recordAdvance') : t('workers.recordPayment')} onClose={() => setPaymentModal(null)}>
          <form className="login-form compact-form" onSubmit={savePayment}>
            <label>
              {t('common.site')}
              <select
                onChange={(event) => setPaymentForm({ ...paymentForm, site_id: event.target.value })}
                required
                value={paymentForm.site_id}
              >
                <option value="">{t('common.site')}</option>
                {worker.sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </label>
            <label>
              {t('common.date')}
              <input
                onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })}
                required
                type="date"
                value={paymentForm.payment_date}
              />
            </label>
            <label>
              {t('common.amount')}
              <input
                min="0.01"
                onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                required
                step="0.01"
                type="number"
                value={paymentForm.amount}
              />
            </label>
            <label>
              {t('common.note')}
              <input
                onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })}
                type="text"
                value={paymentForm.note}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button disabled={worker.sites.length === 0} type="submit">{t('payments.recordPayment')}</button>
          </form>
        </Modal>
      )}
    </section>
    </div>
  );
}

function emptyPaymentForm(worker) {
  return {
    site_id: worker?.sites?.[0]?.id ? String(worker.sites[0].id) : '',
    payment_date: todayString(),
    type: 'advance',
    amount: '',
    note: '',
  };
}

function WorkerFormModal({
  title,
  workerForm,
  setWorkerForm,
  selectedWorker,
  sites = null,
  showFinancialFields = true,
  onClose,
  onSubmit,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <form className="login-form compact-form" onSubmit={onSubmit}>
        {!selectedWorker && sites && (
          <label>
            {t('common.site')}
            <select
              onChange={(event) => setWorkerForm({ ...workerForm, site_id: event.target.value })}
              required
              value={workerForm.site_id}
            >
              <option value="">{t('common.site')}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('workers.name')}
          <input
            onChange={(event) => setWorkerForm({ ...workerForm, name: event.target.value })}
            required
            type="text"
            value={workerForm.name}
          />
        </label>
        <label>
          {t('common.phone')}
          <input
            onChange={(event) => setWorkerForm({ ...workerForm, phone: event.target.value })}
            type="text"
            value={workerForm.phone}
          />
        </label>
        {showFinancialFields && (
          <>
            <label>
              {t('workers.dailyWage')}
              <input
                min="0"
                onChange={(event) => setWorkerForm({ ...workerForm, daily_wage: event.target.value })}
                step="0.01"
                type="number"
                value={workerForm.daily_wage}
              />
            </label>
          </>
        )}
        <button disabled={!selectedWorker && sites && sites.length === 0} type="submit">
          {selectedWorker ? t('common.saveChanges') : t('workers.createButton')}
        </button>
      </form>
    </Modal>
  );
}

function emptyWorkerForm() {
  return {
    name: '',
    phone: '',
    daily_wage: '',
    status: 'active',
    site_id: '',
  };
}
