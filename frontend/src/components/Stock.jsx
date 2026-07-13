import React, { useEffect, useState } from 'react';
import { sitesApi, stockApi } from '../api/client';
import { formatMoney, todayString } from '../utils/format';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function StockManagement({ role }) {
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [balances, setBalances] = useState([]);
  const [itemForm, setItemForm] = useState({ name: '', unit: '' });
  const [cashForm, setCashForm] = useState({ site_id: '', amount: '', transfer_date: todayString(), note: '' });
  const [purchaseForm, setPurchaseForm] = useState({ site_id: '', item_id: '', purchase_date: todayString(), quantity: '', unit_price: '', note: '' });
  const [usageForm, setUsageForm] = useState({ site_id: '', item_id: '', usage_date: todayString(), quantity: '', note: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    try {
      const [siteList, itemList, balanceList] = await Promise.all([sitesApi.list(), stockApi.items(), stockApi.balances()]);
      setSites(siteList);
      setItems(itemList);
      setBalances(balanceList);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load stock data.');
    }
  }

  async function submit(action, reset) {
    setError('');
    setMessage('');
    try {
      await action();
      reset();
      setMessage(t('stock.saved'));
      showToast(t('stock.saved'));
      await loadStock();
      setModal(null);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save stock data.');
    }
  }

  function assignedSiteId() {
    return sites[0]?.id ? String(sites[0].id) : '';
  }

  function openPurchaseModal() {
    if (role === 'site_incharge' && !assignedSiteId()) {
      setError(t('sites.noAssigned'));
      return;
    }
    setPurchaseForm((currentForm) => ({ ...currentForm, site_id: currentForm.site_id || assignedSiteId() }));
    setModal('purchase');
  }

  function openUsageModal() {
    if (role === 'site_incharge' && !assignedSiteId()) {
      setError(t('sites.noAssigned'));
      return;
    }
    setUsageForm((currentForm) => ({ ...currentForm, site_id: currentForm.site_id || assignedSiteId() }));
    setModal('usage');
  }

  return (
    <div className="dashboard-body">
      <section className="panel">
        <h2>{t('stock.title')}</h2>
        {error && <p className="form-error">{error}</p>}
        {role === 'owner' && (
          <div className="action-row">
            <button className="new-button" onClick={() => setModal('item')} type="button"><span aria-hidden="true">+</span>{t('stock.newItem')}</button>
            <button className="ghost-button" onClick={() => setModal('cash')} type="button">{t('stock.cashTransfer')}</button>
          </div>
        )}
        {role === 'site_incharge' && (
          <div className="action-row">
            <button className="ghost-button" disabled={sites.length === 0} onClick={openPurchaseModal} type="button">{t('stock.purchase')}</button>
            <button className="ghost-button" disabled={sites.length === 0} onClick={openUsageModal} type="button">{t('stock.usage')}</button>
          </div>
        )}
        {modal === 'item' && (
          <Modal title="Create Stock Item" onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => stockApi.createItem(itemForm), () => setItemForm({ name: '', unit: '' })); }}>
              <input placeholder="Item name" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
              <input placeholder="Unit" value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} />
              <button type="submit">Create item</button>
            </form>
          </Modal>
        )}
        {modal === 'cash' && (
          <Modal title="Cash Transfer" onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => stockApi.cashTransfer({ ...cashForm, amount: Number(cashForm.amount) }), () => setCashForm({ site_id: '', amount: '', transfer_date: todayString(), note: '' })); }}>
              <SiteSelect sites={sites} value={cashForm.site_id} onChange={(site_id) => setCashForm({ ...cashForm, site_id })} />
              <input type="date" value={cashForm.transfer_date} onChange={(event) => setCashForm({ ...cashForm, transfer_date: event.target.value })} />
              <input placeholder="Amount" type="number" value={cashForm.amount} onChange={(event) => setCashForm({ ...cashForm, amount: event.target.value })} />
              <input placeholder="Note" value={cashForm.note} onChange={(event) => setCashForm({ ...cashForm, note: event.target.value })} />
              <button type="submit">Record cash</button>
            </form>
          </Modal>
        )}
        {modal === 'purchase' && (
          <Modal title="Stock Purchase" onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => stockApi.purchase({ ...purchaseForm, quantity: Number(purchaseForm.quantity), unit_price: Number(purchaseForm.unit_price) }), () => setPurchaseForm({ site_id: '', item_id: '', purchase_date: todayString(), quantity: '', unit_price: '', note: '' })); }}>
              {role === 'owner' && <SiteSelect sites={sites} value={purchaseForm.site_id} onChange={(site_id) => setPurchaseForm({ ...purchaseForm, site_id })} />}
              <ItemSelect items={items} value={purchaseForm.item_id} onChange={(item_id) => setPurchaseForm({ ...purchaseForm, item_id })} />
              <input type="date" value={purchaseForm.purchase_date} onChange={(event) => setPurchaseForm({ ...purchaseForm, purchase_date: event.target.value })} />
              <input placeholder="Quantity" type="number" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} />
              <input placeholder="Unit price" type="number" value={purchaseForm.unit_price} onChange={(event) => setPurchaseForm({ ...purchaseForm, unit_price: event.target.value })} />
              <input placeholder="Note" value={purchaseForm.note} onChange={(event) => setPurchaseForm({ ...purchaseForm, note: event.target.value })} />
              <button type="submit">Record purchase</button>
            </form>
          </Modal>
        )}
        {modal === 'usage' && (
          <Modal title="Stock Usage" onClose={() => setModal(null)}>
            <form className="login-form compact-form" onSubmit={(event) => { event.preventDefault(); submit(() => stockApi.usage({ ...usageForm, quantity: Number(usageForm.quantity) }), () => setUsageForm({ site_id: '', item_id: '', usage_date: todayString(), quantity: '', note: '' })); }}>
              {role === 'owner' && <SiteSelect sites={sites} value={usageForm.site_id} onChange={(site_id) => setUsageForm({ ...usageForm, site_id })} />}
              <ItemSelect items={items} value={usageForm.item_id} onChange={(item_id) => setUsageForm({ ...usageForm, item_id })} />
              <input type="date" value={usageForm.usage_date} onChange={(event) => setUsageForm({ ...usageForm, usage_date: event.target.value })} />
              <input placeholder="Quantity" type="number" value={usageForm.quantity} onChange={(event) => setUsageForm({ ...usageForm, quantity: event.target.value })} />
              <input placeholder="Note" value={usageForm.note} onChange={(event) => setUsageForm({ ...usageForm, note: event.target.value })} />
              <button type="submit">Record usage</button>
            </form>
          </Modal>
        )}
      </section>
      <section className="panel">
        <h2>{t('stock.balances')}</h2>
        <VisibleList
          items={balances}
          emptyText=""
          renderItem={(row) => (
            <div className="site-card read-only-card" key={`${row.site_id}-${row.item_id}`}>
              <span>{row.item_name}</span>
              <small>{role === 'owner' ? `${row.site_name}: ` : ''}{row.remaining_quantity} {row.unit} {t('stock.left')}</small>
              <small>{t('stock.cashLeft')} {formatMoney(row.cash_remaining)}</small>
            </div>
          )}
        />
      </section>
    </div>
  );
}

export function SiteSelect({ sites, value, onChange }) {
  return <select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select>;
}

export function ItemSelect({ items, value, onChange }) {
  return <select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select>;
}

