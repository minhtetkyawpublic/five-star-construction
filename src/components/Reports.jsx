import React, { useEffect, useState } from 'react';
import { attendanceApi, reportLockingApi, reportsApi, sitesApi } from '../api/client';
import { formatMoney, monthString, todayString } from '../utils/format';
import { Modal } from './Modal';
import { OwnerWorkerPayments } from './Payments';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function ReportsDashboard({ role }) {
  const tabs = ['Worker Monthly', 'Daily Attendance', 'Worker Payments', 'Stock/Cash Monthly', 'Edit Requests'];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="dashboard-body">
      <div className="filter-row report-type-picker">
        <select id="report-type" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
          {tabs.map((tab) => (
            <option key={tab} value={tab}>
              {reportTabLabel(tab)}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'Worker Monthly' && <MonthlyWorkerReports />}
      {activeTab === 'Daily Attendance' && <OwnerDailyReports />}
      {activeTab === 'Worker Payments' && <OwnerWorkerPayments />}
      {activeTab === 'Stock/Cash Monthly' && <MonthlyStockReports />}
      {activeTab === 'Edit Requests' && <EditRequestsPanel role={role} />}
    </div>
  );
}

export function OwnerDailyReports() {
  const [sites, setSites] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [filters, setFilters] = useState({ date: todayString(), site_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');

    try {
      const [siteList, reportList] = await Promise.all([
        sitesApi.list(),
        attendanceApi.list({
          date: filters.date,
          site_id: filters.site_id,
        }),
      ]);
      setSites(siteList);
      setReports(reportList);
      setSelectedReport(null);
      setSelectedReportId('');
      setFilterOpen(false);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load daily reports.');
    } finally {
      setLoading(false);
    }
  }

  async function openReport(report) {
    setError('');
    setSelectedReportId(String(report.id));

    try {
      setSelectedReport(await attendanceApi.get(report.id));
    } catch (reportError) {
      setError(reportError.message || 'Unable to open daily report.');
    }
  }

  function chooseReport(reportId) {
    setSelectedReportId(reportId);
    setSelectedReport(null);

    const report = reports.find((item) => String(item.id) === String(reportId));
    if (report) {
      openReport(report);
    }
  }

  return (
    <div className="dashboard-body">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Daily Reports</h2>
          </div>
          <button className="ghost-button" onClick={() => setFilterOpen(true)} type="button">Filter</button>
        </div>

        {filterOpen && (
          <Modal title="Filter Daily Reports" onClose={() => setFilterOpen(false)}>
            <form className="login-form compact-form" onSubmit={loadReports}>
              <label>
                Date
                <input
                  onChange={(event) => setFilters({ ...filters, date: event.target.value })}
                  type="date"
                  value={filters.date}
                />
              </label>
              <label>
                Site
                <select
                  onChange={(event) => setFilters({ ...filters, site_id: event.target.value })}
                  value={filters.site_id}
                >
                  <option value="">All sites</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Load reports</button>
            </form>
          </Modal>
        )}

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="hint">Loading daily reports...</p>}

        {!loading && reports.length === 0 && <p className="empty-state">{t('reports.noReports')}</p>}
        {reports.length > 0 && (
          <div className="filter-row report-picker">
            <label htmlFor="daily-report-picker">{t('common.site')}</label>
            <select
              id="daily-report-picker"
              onChange={(event) => chooseReport(event.target.value)}
              value={selectedReportId}
            >
              <option value="">{t('reports.selectSiteReport')}</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.site_name} - {report.report_date} - {report.attendance.length} workers
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedReport && <DailyReportDetail report={selectedReport} />}
      </section>
    </div>
  );
}

export function DailyReportDetail({ report }) {
  const summary = attendanceSummary(report.attendance);

  return (
    <div className="report-detail">
      <h3>{report.site_name}</h3>
      <p className="section-copy">
        {report.report_date} - submitted by {report.submitted_by.name}
      </p>
      <div className="info-grid attendance-summary-grid">
        <div className="info-cell">
          <span>{t('attendance.present')}</span>
          <strong><span className="attendance-status present">{summary.present}</span></strong>
        </div>
        <div className="info-cell">
          <span>{t('attendance.absent')}</span>
          <strong><span className="attendance-status absent">{summary.absent}</span></strong>
        </div>
        <div className="info-cell">
          <span>{t('attendance.halfDay')}</span>
          <strong><span className="attendance-status half_day">{summary.half_day}</span></strong>
        </div>
      </div>
      <div className="card-list">
        {report.attendance.map((entry) => (
          <div className="site-card read-only-card" key={entry.worker_id}>
            <span>{entry.worker_name}</span>
            <small><span className={`attendance-status ${entry.status}`}>{attendanceStatusLabel(entry.status)}</span></small>
            {entry.note && <small>{entry.note}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

function attendanceSummary(attendance) {
  return attendance.reduce(
    (totals, entry) => ({
      ...totals,
      [entry.status]: (totals[entry.status] || 0) + 1,
    }),
    { present: 0, absent: 0, half_day: 0 },
  );
}

function attendanceStatusLabel(status) {
  const labels = {
    present: t('attendance.present'),
    absent: t('attendance.absent'),
    half_day: t('attendance.halfDay'),
  };
  return labels[status] || status;
}

export function MonthlyWorkerReports() {
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({ month: monthString(), site_id: '' });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    sitesApi.list().then(setSites).catch(() => {});
    loadReport();
  }, []);

  async function loadReport(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      setRows(await reportsApi.monthlyWorkers(filters));
      setFilterOpen(false);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load monthly worker report.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Monthly Worker Report</h2>
        <button className="ghost-button" onClick={() => setFilterOpen(true)} type="button">{t('common.filter')}</button>
      </div>
      {filterOpen && (
        <Modal title="Filter Monthly Worker Report" onClose={() => setFilterOpen(false)}>
          <FilterForm filters={filters} setFilters={setFilters} sites={sites} onSubmit={loadReport} />
        </Modal>
      )}
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">Loading worker report...</p>}
      <VisibleList
        items={rows}
        loading={loading}
        emptyText={t('reports.noWorkerData')}
        className="card-list report-list"
        renderItem={(row) => (
          <div className="site-card read-only-card" key={`${row.site_id}-${row.worker_id}`}>
            <span>{row.worker_name}</span>
            <small>{row.site_name} - {row.working_days} days</small>
            <small>{attendanceStatusLabel('present')} {row.working_days} {t('workers.perDay')}</small>
            <small>{workersReportLabel('wage')} {formatMoney(row.wage_total)} | {workersReportLabel('paid')} {formatMoney(row.paid_total)}</small>
            <small>{workersReportLabel('advance')} {formatMoney(row.advance_total)} | {workersReportLabel('balance')} {formatMoney(row.remaining_balance)}</small>
          </div>
        )}
      />
    </section>
  );
}

function workersReportLabel(label) {
  const labels = {
    wage: t('workers.earnedWage'),
    paid: t('workers.wagePaid'),
    advance: t('workers.upfrontMoney'),
    balance: t('workers.remainingPayable'),
  };
  return labels[label] || label;
}

export function MonthlyStockReports() {
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({ month: monthString(), site_id: '' });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    sitesApi.list().then(setSites).catch(() => {});
    loadReport();
  }, []);

  async function loadReport(event) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      setRows(await reportsApi.monthlyStock(filters));
      setFilterOpen(false);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load monthly stock report.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>{t('reports.monthlyStockTitle')}</h2>
        <button className="ghost-button" onClick={() => setFilterOpen(true)} type="button">Filter</button>
      </div>
      {filterOpen && (
        <Modal title={t('reports.filterStockCash')} onClose={() => setFilterOpen(false)}>
          <FilterForm filters={filters} setFilters={setFilters} sites={sites} onSubmit={loadReport} />
        </Modal>
      )}
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">{t('reports.loadingStock')}</p>}
      <VisibleList
        items={rows}
        loading={loading}
        emptyText={t('reports.noStockData')}
        className="card-list report-list"
        renderItem={(site) => (
          <div className="site-card read-only-card" key={site.site_id}>
            <span>{site.site_name}</span>
            <small>{t('reports.cash')} {formatMoney(site.cash_received)} | {t('reports.purchases')} {formatMoney(site.purchase_total)}</small>
            <small>{t('reports.expectedCashLeft')} {formatMoney(site.expected_cash_remaining)}</small>
            {site.items.map((item) => (
              <small key={item.item_id}>
                {item.item_name}: {item.remaining_quantity} {item.unit} {t('stock.left')}
              </small>
            ))}
          </div>
        )}
      />
    </section>
  );
}

export function FilterForm({ filters, setFilters, sites, onSubmit }) {
  return (
    <form className="login-form compact-form" onSubmit={onSubmit}>
      <label>
        Month
        <input onChange={(event) => setFilters({ ...filters, month: event.target.value })} type="month" value={filters.month} />
      </label>
      <label>
        Site
        <select onChange={(event) => setFilters({ ...filters, site_id: event.target.value })} value={filters.site_id}>
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
      </label>
      <button type="submit">Load report</button>
    </form>
  );
}

export function SettingsPanel() {
  const [settings, setSettings] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setError('');
    try {
      setSettings(await reportLockingApi.settings());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load settings.');
    }
  }

  return (
    <div className="dashboard-body">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Settings</h2>
            <p className="section-copy">Manage report locking for worker and cash/stock reports.</p>
          </div>
          <button className="ghost-button" onClick={() => setSettingsOpen(true)} type="button">Edit locking</button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="card-list">
          {settings.length === 0 && <p className="empty-state">No settings loaded.</p>}
          {settings.map((setting) => (
            <div className="site-card read-only-card" key={setting.id}>
              <span>{setting.site_name || 'Global default'}</span>
              <small>Worker: {setting.worker_lock_enabled ? `Locked after ${setting.worker_cutoff_time}` : 'No locking'}</small>
              <small>Cash/Stock: {setting.stock_lock_enabled ? `Locked after ${setting.stock_cutoff_time}` : 'No locking'}</small>
            </div>
          ))}
        </div>
      </section>
      {settingsOpen && (
        <Modal title="Report Locking Settings" onClose={() => setSettingsOpen(false)}>
          <ReportSettingsForm onSaved={() => { setSettingsOpen(false); loadSettings(); }} />
        </Modal>
      )}
    </div>
  );
}

export function ReportSettingsForm({ onSaved }) {
  const [sites, setSites] = useState([]);
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState({
    site_id: '',
    worker_lock_enabled: true,
    worker_cutoff_time: '21:00',
    stock_lock_enabled: true,
    stock_cutoff_time: '21:00',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([sitesApi.list(), reportLockingApi.settings()])
      .then(([siteList, settingList]) => {
        setSites(siteList);
        setSettings(settingList);
        const global = settingList.find((setting) => setting.site_id === null);
        if (global) {
          applySetting(global);
        }
      })
      .catch(() => {});
  }, []);

  function applySetting(setting) {
    setForm({
      site_id: setting.site_id ?? '',
      worker_lock_enabled: Boolean(setting.worker_lock_enabled),
      worker_cutoff_time: (setting.worker_cutoff_time || '21:00').slice(0, 5),
      stock_lock_enabled: Boolean(setting.stock_lock_enabled),
      stock_cutoff_time: (setting.stock_cutoff_time || '21:00').slice(0, 5),
    });
  }

  function changeSite(siteId) {
    const existing = settings.find((setting) => String(setting.site_id ?? '') === String(siteId));
    if (existing) {
      applySetting(existing);
      return;
    }

    setForm({
      site_id: siteId,
      worker_lock_enabled: true,
      worker_cutoff_time: '21:00',
      stock_lock_enabled: true,
      stock_cutoff_time: '21:00',
    });
  }

  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await reportLockingApi.saveSetting(form);
      setMessage('Cutoff saved.');
      showToast('Cutoff saved.');
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save cutoff.');
    }
  }
  return (
    <form className="login-form compact-form" onSubmit={save}>
      <label>
        Site
        <select value={form.site_id} onChange={(event) => changeSite(event.target.value)}>
          <option value="">Global default</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
      </label>
      <label className="check-row">
        <input
          checked={form.worker_lock_enabled}
          onChange={(event) => setForm({ ...form, worker_lock_enabled: event.target.checked })}
          type="checkbox"
        />
        <span><strong>Lock worker reports</strong><small>Attendance, wage payments, and advances</small></span>
      </label>
      <label>
        Worker cutoff time
        <input type="time" value={form.worker_cutoff_time} onChange={(event) => setForm({ ...form, worker_cutoff_time: event.target.value })} />
      </label>
      <label className="check-row">
        <input
          checked={form.stock_lock_enabled}
          onChange={(event) => setForm({ ...form, stock_lock_enabled: event.target.checked })}
          type="checkbox"
        />
        <span><strong>Lock cash/stock reports</strong><small>Cash transfers, purchases, and usage</small></span>
      </label>
      <label>
        Cash/stock cutoff time
        <input type="time" value={form.stock_cutoff_time} onChange={(event) => setForm({ ...form, stock_cutoff_time: event.target.value })} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit">Save settings</button>
    </form>
  );
}

export function EditRequestsPanel({ role }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { load(); }, []);
  async function load() {
    try {
      setRequests(await reportLockingApi.editRequests());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load edit requests.');
    }
  }
  async function review(id, status) {
    await reportLockingApi.review(id, status);
    await load();
  }
  return (
    <section className="panel">
      <h2>Edit Requests</h2>
      {error && <p className="form-error">{error}</p>}
      <VisibleList
        items={requests}
        emptyText={t('reports.noEditRequests')}
        renderItem={(request) => (
          <div className="site-card read-only-card" key={request.id}>
            <span>{request.site_name}</span>
            <small>{request.report_date} - {request.status}</small>
            <small>{request.reason}</small>
            {role === 'owner' && request.status === 'pending' && (
              <div className="inline-actions">
                <button type="button" onClick={() => review(request.id, 'approved')}>Approve</button>
                <button type="button" onClick={() => review(request.id, 'rejected')}>Reject</button>
              </div>
            )}
          </div>
        )}
      />
    </section>
  );
}

function reportTabLabel(tab) {
  const labels = {
    'Worker Monthly': t('reports.workerMonthly'),
    'Daily Attendance': t('reports.dailyAttendance'),
    'Worker Payments': t('reports.workerPayments'),
    'Stock/Cash Monthly': t('reports.stockCashMonthly'),
    'Edit Requests': t('reports.editRequests'),
  };

  return labels[tab] || tab;
}

