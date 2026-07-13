import React, { useEffect, useState } from 'react';
import { sitesApi, workerPaymentsApi, workersApi } from '../api/client';
import { formatMoney, todayString } from '../utils/format';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function SiteWorkerPayments({ site, workers }) {
  const [form, setForm] = useState(emptyPaymentForm());
  const [payments, setPayments] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [site.id]);

  async function loadPayments() {
    setLoading(true);
    setError('');

    try {
      setPayments(await workerPaymentsApi.list({ site_id: site.id }));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load worker payments.');
    } finally {
      setLoading(false);
    }
  }

  async function savePayment(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await workerPaymentsApi.create({
        site_id: site.id,
        worker_id: Number(form.worker_id),
        payment_date: form.payment_date,
        type: form.type,
        amount: Number(form.amount || 0),
        note: form.note,
      });
      setForm(emptyPaymentForm());
      setMessage(t('payments.recorded'));
      showToast(t('payments.recorded'));
      await loadPayments();
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError.message || 'Unable to record worker payment.');
    }
  }

  return (
    <div className="payment-entry">
      <div className="section-header">
        <h3>{t('payments.title')}</h3>
        <button className="ghost-button" onClick={() => setModalOpen(true)} type="button">
          {t('payments.record')}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {modalOpen && (
        <Modal title={t('payments.recordTitle')} onClose={() => setModalOpen(false)}>
      <form className="login-form compact-form" onSubmit={savePayment}>
        <label>
          {t('common.worker')}
          <select
            onChange={(event) => setForm({ ...form, worker_id: event.target.value })}
            required
            value={form.worker_id}
          >
            <option value="">{t('common.worker')}</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('common.date')}
          <input
            onChange={(event) => setForm({ ...form, payment_date: event.target.value })}
            required
            type="date"
            value={form.payment_date}
          />
        </label>
        <label>
          {t('payments.type')}
          <select onChange={(event) => setForm({ ...form, type: event.target.value })} value={form.type}>
            <option value="wage_payment">{t('payments.wagePayment')}</option>
            <option value="advance">{t('payments.advance')}</option>
          </select>
        </label>
        <label>
          {t('common.amount')}
          <input
            min="0.01"
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            required
            step="0.01"
            type="number"
            value={form.amount}
          />
        </label>
        <label>
          {t('common.note')}
          <input onChange={(event) => setForm({ ...form, note: event.target.value })} type="text" value={form.note} />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button disabled={workers.length === 0} type="submit">{t('payments.recordPayment')}</button>
      </form>
        </Modal>
      )}

      <div className="payment-history">
        <h3>{t('payments.history')}</h3>
        {loading && <p className="hint">Loading worker payments...</p>}
        <PaymentList payments={payments} emptyText={t('payments.noPayments')} />
      </div>
    </div>
  );
}

export function OwnerWorkerPayments() {
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [filters, setFilters] = useState({
    site_id: '',
    worker_id: '',
    date: '',
    type: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');

    try {
      const [siteList, workerList, paymentList] = await Promise.all([
        sitesApi.list(),
        workersApi.list(),
        workerPaymentsApi.list(filters),
      ]);
      setSites(siteList);
      setWorkers(workerList);
      setPayments(paymentList);
      setFilterOpen(false);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load worker payments.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-body">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>{t('payments.title')}</h2>
          </div>
          <button className="ghost-button" onClick={() => setFilterOpen(true)} type="button">
            {t('common.filter')}
          </button>
        </div>

        {filterOpen && (
          <Modal title={t('common.filter')} onClose={() => setFilterOpen(false)}>
        <form className="login-form compact-form" onSubmit={loadPayments}>
          <label>
            {t('common.site')}
            <select
              onChange={(event) => setFilters({ ...filters, site_id: event.target.value })}
              value={filters.site_id}
            >
              <option value="">{t('common.allSites')}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('common.worker')}
            <select
              onChange={(event) => setFilters({ ...filters, worker_id: event.target.value })}
              value={filters.worker_id}
            >
              <option value="">{t('common.worker')}</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('common.date')}
            <input
              onChange={(event) => setFilters({ ...filters, date: event.target.value })}
              type="date"
              value={filters.date}
            />
          </label>
          <label>
            {t('payments.type')}
            <select onChange={(event) => setFilters({ ...filters, type: event.target.value })} value={filters.type}>
              <option value="">All types</option>
              <option value="wage_payment">{t('payments.wagePayment')}</option>
              <option value="advance">{t('payments.advance')}</option>
            </select>
          </label>
          <button type="submit">{t('payments.title')}</button>
        </form>
          </Modal>
        )}

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="hint">Loading worker payments...</p>}
        <PaymentList payments={payments} emptyText={t('payments.noPayments')} />
      </section>
    </div>
  );
}

export function PaymentList({ payments, emptyText }) {
  if (payments.length === 0) {
    return <p className="empty-state">{emptyText}</p>;
  }

  return (
    <VisibleList
      items={payments}
      emptyText={emptyText}
      className="card-list payment-list"
      renderItem={(payment) => (
        <div className="site-card read-only-card" key={payment.id}>
          <span>{payment.worker_name}</span>
          <small>{payment.site_name} - {payment.payment_date}</small>
          <small>{payment.type === 'advance' ? t('payments.advance') : t('payments.wagePayment')} - {formatMoney(payment.amount)}</small>
          {payment.note && <small>{payment.note}</small>}
        </div>
      )}
    />
  );
}

function emptyPaymentForm() {
  return {
    worker_id: '',
    payment_date: todayString(),
    type: 'wage_payment',
    amount: '',
    note: '',
  };
}

