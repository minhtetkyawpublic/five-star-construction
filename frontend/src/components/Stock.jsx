import React, { useEffect, useMemo, useState } from 'react';
import { sitesApi, stockApi } from '../api/client';
import { formatMoney, todayString } from '../utils/format';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function StockManagement({ role }) {
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [siteSummaries, setSiteSummaries] = useState([]);
  const [balances, setBalances] = useState([]);
  const [cashTransfers, setCashTransfers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [usages, setUsages] = useState([]);
  const [siteFilter, setSiteFilter] = useState('');
  const [siteStatusFilter, setSiteStatusFilter] = useState('current');
  const [itemForm, setItemForm] = useState({ name: '', unit: '' });
  const [cashForm, setCashForm] = useState({ site_id: '', amount: '', transfer_date: todayString(), note: '' });
  const [purchaseForm, setPurchaseForm] = useState({ site_id: '', item_name: '', unit: '', purchase_date: todayString(), quantity: '', unit_price: '', note: '' });
  const [usageForm, setUsageForm] = useState({ site_id: '', item_id: '', item_name: '', usage_date: todayString(), quantity: '', note: '' });
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const stockTabs = role === 'owner' ? ['overview', 'cash', 'purchases', 'usage'] : ['overview', 'purchases', 'usage'];
  const [activeStockTab, setActiveStockTab] = useState('overview');

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    try {
      const [siteList, itemList, balanceData, cashRows, purchaseRows, usageRows] = await Promise.all([
        sitesApi.list(),
        stockApi.items(),
        stockApi.balances(),
        role === 'owner' ? stockApi.cashTransfers() : Promise.resolve([]),
        stockApi.purchases(),
        stockApi.usages(),
      ]);
      setSites(siteList);
      setItems(itemList);
      setSiteSummaries(balanceData.site_summaries);
      setBalances(balanceData.stock_balances);
      setCashTransfers(cashRows);
      setPurchases(purchaseRows);
      setUsages(usageRows);
    } catch (loadError) {
      setError(loadError.message || t('stock.loadError'));
    }
  }

  async function submit(action, reset) {
    setError('');
    try {
      await action();
      reset();
      showToast(t('stock.saved'));
      await loadStock();
      setModal(null);
    } catch (saveError) {
      setError(saveError.message || t('stock.saveError'));
    }
  }

  const activeSites = sites.filter((site) => site.status === 'active');
  const selectedSiteId = role === 'site_incharge' ? String(activeSites[0]?.id || '') : siteFilter;

  const visibleSummaries = useMemo(() => {
    return siteSummaries.filter((summary) => {
      if (role === 'owner') {
        if (siteStatusFilter === 'current' && summary.site_status !== 'active') return false;
        if (siteStatusFilter === 'completed' && summary.site_status === 'active') return false;
        if (selectedSiteId && String(summary.site_id) !== String(selectedSiteId)) return false;
      }
      return true;
    });
  }, [role, selectedSiteId, siteStatusFilter, siteSummaries]);

  const visibleBalances = useMemo(() => {
    const visibleSiteIds = new Set(visibleSummaries.map((summary) => String(summary.site_id)));
    return balances.filter((row) => visibleSiteIds.has(String(row.site_id)));
  }, [balances, visibleSummaries]);

  const visibleCashTransfers = useMemo(() => filterTransactions(cashTransfers, visibleSummaries), [cashTransfers, visibleSummaries]);
  const visiblePurchases = useMemo(() => filterTransactions(purchases, visibleSummaries), [purchases, visibleSummaries]);
  const visibleUsages = useMemo(() => filterTransactions(usages, visibleSummaries), [usages, visibleSummaries]);

  const stockBySite = useMemo(() => {
    return visibleBalances.reduce((groups, row) => {
      const key = String(row.site_id);
      groups[key] = groups[key] || [];
      groups[key].push(row);
      return groups;
    }, {});
  }, [visibleBalances]);

  function activeAssignedSiteId() {
    return activeSites[0]?.id ? String(activeSites[0].id) : '';
  }

  function openCashModal() {
    const firstActiveSiteId = activeSites[0]?.id ? String(activeSites[0].id) : '';
    setCashForm((currentForm) => ({ ...currentForm, site_id: currentForm.site_id || firstActiveSiteId }));
    setModal('cash');
  }

  function openPurchaseModal() {
    const siteId = activeAssignedSiteId();
    if (!siteId) {
      setError(t('sites.noAssigned'));
      return;
    }
    setPurchaseForm({ site_id: siteId, item_name: '', unit: '', purchase_date: todayString(), quantity: '', unit_price: '', note: '' });
    setModal('purchase');
  }

  function openUsageModal() {
    const siteId = activeAssignedSiteId();
    if (!siteId) {
      setError(t('sites.noAssigned'));
      return;
    }
    setUsageForm({ site_id: siteId, item_id: '', item_name: '', usage_date: todayString(), quantity: '', note: '' });
    setModal('usage');
  }

  function editPurchase(purchase) {
    setPurchaseForm({
      id: purchase.id,
      site_id: String(purchase.site_id),
      item_name: purchase.item_name,
      unit: purchase.unit,
      purchase_date: purchase.purchase_date,
      quantity: String(purchase.quantity),
      unit_price: String(purchase.unit_price),
      note: purchase.note || '',
    });
    setModal('purchase');
  }

  function editUsage(usage) {
    setUsageForm({
      id: usage.id,
      site_id: String(usage.site_id),
      item_id: String(usage.item_id),
      item_name: usageDisplayValue(usage),
      usage_date: usage.usage_date,
      quantity: String(usage.quantity),
      note: usage.note || '',
    });
    setModal('usage');
  }

  function balanceForItem(siteId, itemId) {
    return balances.find((row) => String(row.site_id) === String(siteId) && String(row.item_id) === String(itemId));
  }

  function usageDisplayValue(row) {
    return `${row.item_name} (${row.unit})`;
  }

  function changeUsageItem(itemId) {
    const item = availableUsageItems.find((row) => String(row.item_id) === String(itemId));
    setUsageForm((currentForm) => ({
      ...currentForm,
      item_name: item ? usageDisplayValue(item) : '',
      item_id: itemId,
    }));
  }

  const purchaseTotal = Number(purchaseForm.quantity || 0) * Number(purchaseForm.unit_price || 0);
  const usageAvailable = usageForm.item_id
    ? Number(balanceForItem(usageForm.site_id, usageForm.item_id)?.remaining_quantity || 0) + Number(usageForm.id ? usageForm.quantity || 0 : 0)
    : 0;
  const availableUsageItems = balances.filter((row) => String(row.site_id) === String(activeAssignedSiteId()) && Number(row.remaining_quantity) > 0);

  return (
    <div className="dashboard-body">
      <section className="panel">
        <div className="filter-row report-type-picker">
          <select
            id="stock-view"
            onChange={(event) => setActiveStockTab(event.target.value)}
            value={activeStockTab}
          >
            {stockTabs.map((tab) => (
              <option key={tab} value={tab}>{stockTabLabel(tab)}</option>
            ))}
          </select>
        </div>

        {error && <p className="form-error">{error}</p>}

        {role === 'owner' && (
          <>
            <div className="status-filter">
              {['current', 'completed', 'all'].map((status) => (
                <button
                  className={siteStatusFilter === status ? 'active' : ''}
                  key={status}
                  onClick={() => {
                    setSiteStatusFilter(status);
                    setSiteFilter('');
                  }}
                  type="button"
                >
                  {siteStatusLabel(status)}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <label htmlFor="stock-site-filter">{t('stock.siteFilter')}</label>
              <select id="stock-site-filter" onChange={(event) => setSiteFilter(event.target.value)} value={siteFilter}>
                <option value="">{t('stock.allSites')}</option>
                {sites
                  .filter((site) => siteStatusFilter === 'all' || (siteStatusFilter === 'current' ? site.status === 'active' : site.status !== 'active'))
                  .map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </div>
          </>
        )}

        {role === 'owner' && activeStockTab === 'overview' && (
          <button className="new-button full-width-action" onClick={() => setModal('item')} type="button">
            <span aria-hidden="true">+</span>{t('stock.newItem')}
          </button>
        )}

        {role === 'owner' && activeStockTab === 'cash' && (
          <button className="new-button full-width-action" disabled={activeSites.length === 0} onClick={openCashModal} type="button">
            <span aria-hidden="true">+</span>{t('stock.giveCash')}
          </button>
        )}

        {role === 'site_incharge' && activeStockTab === 'purchases' && (
          <button className="new-button full-width-action" disabled={activeSites.length === 0} onClick={openPurchaseModal} type="button">
            <span aria-hidden="true">+</span>{t('stock.recordPurchase')}
          </button>
        )}

        {role === 'site_incharge' && activeStockTab === 'usage' && (
          <button className="new-button full-width-action" disabled={activeSites.length === 0} onClick={openUsageModal} type="button">
            <span aria-hidden="true">+</span>{t('stock.recordUsage')}
          </button>
        )}

        {role === 'site_incharge' && activeSites.length === 0 && <p className="empty-state">{t('sites.noActiveSite')}</p>}

        {modal === 'item' && (
          <Modal title={t('stock.createItem')} onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => stockApi.createItem(itemForm), () => setItemForm({ name: '', unit: '' })); }}>
              <label>{t('stock.itemName')}<input value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} /></label>
              <label>{t('stock.unit')}<input value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} /></label>
              <button type="submit">{t('stock.createItem')}</button>
            </form>
          </Modal>
        )}

        {modal === 'cash' && (
          <Modal title={t('stock.giveCash')} onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => stockApi.cashTransfer({ ...cashForm, amount: Number(cashForm.amount) }), () => setCashForm({ site_id: '', amount: '', transfer_date: todayString(), note: '' })); }}>
              <label>{t('common.site')}<SiteSelect sites={activeSites} value={cashForm.site_id} onChange={(site_id) => setCashForm({ ...cashForm, site_id })} /></label>
              <label>{t('common.date')}<input type="date" value={cashForm.transfer_date} onChange={(event) => setCashForm({ ...cashForm, transfer_date: event.target.value })} /></label>
              <label>{t('stock.amount')}<input type="number" value={cashForm.amount} onChange={(event) => setCashForm({ ...cashForm, amount: event.target.value })} /></label>
              <label>{t('common.note')}<input value={cashForm.note} onChange={(event) => setCashForm({ ...cashForm, note: event.target.value })} /></label>
              <button type="submit">{t('stock.saveCash')}</button>
            </form>
          </Modal>
        )}

        {modal === 'purchase' && (
          <Modal title={t('stock.recordPurchase')} onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => purchaseForm.id ? stockApi.updatePurchase(purchaseForm.id, { ...purchaseForm, quantity: Number(purchaseForm.quantity), unit_price: Number(purchaseForm.unit_price) }) : stockApi.purchase({ ...purchaseForm, quantity: Number(purchaseForm.quantity), unit_price: Number(purchaseForm.unit_price) }), () => setPurchaseForm({ site_id: activeAssignedSiteId(), item_name: '', unit: '', purchase_date: todayString(), quantity: '', unit_price: '', note: '' })); }}>
              <label>
                {t('stock.itemName')}
                <input list="purchase-stock-items" required value={purchaseForm.item_name} onChange={(event) => setPurchaseForm({ ...purchaseForm, item_name: event.target.value })} />
                <datalist id="purchase-stock-items">
                  {items.map((item) => <option key={item.id} value={item.name} />)}
                </datalist>
              </label>
              <label>{t('stock.unit')}<input required value={purchaseForm.unit} onChange={(event) => setPurchaseForm({ ...purchaseForm, unit: event.target.value })} /></label>
              <label>{t('common.date')}<input type="date" value={purchaseForm.purchase_date} onChange={(event) => setPurchaseForm({ ...purchaseForm, purchase_date: event.target.value })} /></label>
              <label>{t('stock.quantity')}<input type="number" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} /></label>
              <label>{t('stock.unitPrice')}<input type="number" value={purchaseForm.unit_price} onChange={(event) => setPurchaseForm({ ...purchaseForm, unit_price: event.target.value })} /></label>
              <div className="calculated-box">{t('stock.purchaseTotal')} {formatMoney(purchaseTotal)}</div>
              <label>{t('common.note')}<input value={purchaseForm.note} onChange={(event) => setPurchaseForm({ ...purchaseForm, note: event.target.value })} /></label>
              <button type="submit">{purchaseForm.id ? t('common.saveChanges') : t('stock.savePurchase')}</button>
            </form>
          </Modal>
        )}

        {modal === 'usage' && (
          <Modal title={t('stock.recordUsage')} onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => usageForm.id ? stockApi.updateUsage(usageForm.id, { ...usageForm, quantity: Number(usageForm.quantity) }) : stockApi.usage({ ...usageForm, quantity: Number(usageForm.quantity) }), () => setUsageForm({ site_id: activeAssignedSiteId(), item_id: '', item_name: '', usage_date: todayString(), quantity: '', note: '' })); }}>
              <label>
                {t('stock.itemName')}
                <select required value={usageForm.item_id} onChange={(event) => changeUsageItem(event.target.value)}>
                  <option value="">{t('stock.selectItem')}</option>
                  {availableUsageItems.map((item) => (
                    <option key={item.item_id} value={item.item_id}>
                      {usageDisplayValue(item)} - {item.remaining_quantity} {item.unit} {t('stock.left')}
                    </option>
                  ))}
                </select>
              </label>
              <label>{t('common.date')}<input type="date" value={usageForm.usage_date} onChange={(event) => setUsageForm({ ...usageForm, usage_date: event.target.value })} /></label>
              <div className="calculated-box">{t('stock.availableStock')} {usageAvailable}</div>
              <label>{t('stock.quantity')}<input type="number" value={usageForm.quantity} onChange={(event) => setUsageForm({ ...usageForm, quantity: event.target.value })} /></label>
              <label>{t('common.note')}<input value={usageForm.note} onChange={(event) => setUsageForm({ ...usageForm, note: event.target.value })} /></label>
              <button type="submit">{usageForm.id ? t('common.saveChanges') : t('stock.saveUsage')}</button>
            </form>
          </Modal>
        )}
      </section>

      {activeStockTab === 'overview' && (
        <VisibleList
          items={visibleSummaries}
          emptyText={role === 'site_incharge' ? t('sites.noActiveSite') : t('stock.noStockData')}
          renderItem={(summary) => (
            <section className="panel stock-site-panel" key={summary.site_id}>
              <h3>{summary.site_name}</h3>
              <div className="stock-summary-grid">
                <SummaryCard label={t('stock.cashReceived')} value={formatMoney(summary.cash_received)} />
                <SummaryCard label={t('stock.spent')} value={formatMoney(summary.purchase_total)} />
                <SummaryCard label={t('stock.cashLeft')} value={formatMoney(summary.cash_remaining)} />
              </div>
              <VisibleList
                items={stockBySite[String(summary.site_id)] || []}
                emptyText={t('stock.noItems')}
                batchSize={6}
                renderItem={(row) => (
                  <div className="site-card read-only-card stock-item-card" key={`${row.site_id}-${row.item_id}`}>
                    <span>{row.item_name}</span>
                    <small>{t('stock.purchased')}: {row.purchased_quantity} {row.unit}</small>
                    <small>{t('stock.used')}: {row.used_quantity} {row.unit}</small>
                    <small>{t('stock.left')}: {row.remaining_quantity} {row.unit}</small>
                  </div>
                )}
              />
            </section>
          )}
        />
      )}

      {activeStockTab === 'cash' && (
        <section className="panel">
          <TransactionGroup title={t('stock.cashTransactions')} rows={visibleCashTransfers} type="cash" />
        </section>
      )}

      {activeStockTab === 'purchases' && (
        <section className="panel">
          <TransactionGroup title={t('stock.purchaseTransactions')} rows={visiblePurchases} type="purchase" onEdit={role === 'site_incharge' ? editPurchase : undefined} />
        </section>
      )}

      {activeStockTab === 'usage' && (
        <section className="panel">
          <TransactionGroup title={t('stock.usageTransactions')} rows={visibleUsages} type="usage" onEdit={role === 'site_incharge' ? editUsage : undefined} />
        </section>
      )}
    </div>
  );
}

function filterTransactions(rows, visibleSummaries) {
  const siteIds = new Set(visibleSummaries.map((summary) => String(summary.site_id)));
  return rows.filter((row) => siteIds.has(String(row.site_id)));
}

function TransactionGroup({ title, rows, type, onEdit }) {
  return (
    <div className="transaction-group">
      <h3>{title}</h3>
      <VisibleList
        items={rows}
        emptyText={t('stock.noTransactions')}
        batchSize={5}
        renderItem={(row) => (
          <div className="site-card read-only-card stock-transaction-card" key={`${type}-${row.id}`}>
            <span>{transactionTitle(row, type)}</span>
            <small>{transactionDate(row, type)}</small>
            <small>{transactionAmount(row, type)}</small>
            <small>{row.site_name}</small>
            {onEdit && (
              <span className="inline-actions">
                <button onClick={() => onEdit(row)} type="button">{t('common.edit')}</button>
              </span>
            )}
          </div>
        )}
      />
    </div>
  );
}

function transactionTitle(row, type) {
  if (type === 'cash') return t('stock.giveCash');
  return `${row.item_name} (${row.unit})`;
}

function transactionDate(row, type) {
  if (type === 'cash') return row.transfer_date;
  if (type === 'purchase') return row.purchase_date;
  return row.usage_date;
}

function transactionAmount(row, type) {
  if (type === 'cash') return formatMoney(row.amount);
  if (type === 'purchase') return `${row.quantity} ${row.unit} - ${formatMoney(row.total_amount)}`;
  return `${row.quantity} ${row.unit}`;
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function siteStatusLabel(status) {
  return {
    current: t('sites.filterCurrent'),
    completed: t('sites.filterCompleted'),
    all: t('sites.filterAll'),
  }[status] || status;
}

function stockTabLabel(tab) {
  return {
    overview: t('stock.overview'),
    cash: t('stock.cash'),
    purchases: t('stock.purchasesTab'),
    usage: t('stock.usageTab'),
  }[tab] || tab;
}

export function SiteSelect({ sites, value, onChange }) {
  return (
    <select required value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t('stock.selectSite')}</option>
      {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
    </select>
  );
}

export function ItemSelect({ items, value, onChange }) {
  return (
    <label>
      {t('stock.itemName')}
      <select required value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t('stock.selectItem')}</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
      </select>
    </label>
  );
}
