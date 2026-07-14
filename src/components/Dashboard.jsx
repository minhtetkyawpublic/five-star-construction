import React, { useEffect, useState } from 'react';
import { authApi, usersApi } from '../api/client';
import { OwnerSites, AssignedSites } from './Sites';
import { OwnerWorkers, SiteInchargeWorkers } from './Workers';
import { ReportsDashboard, SettingsPanel } from './Reports';
import { StockManagement } from './Stock';
import { Modal } from './Modal';
import { showToast } from './Toast';
import { VisibleList } from './VisibleList';
import { t } from '../i18n/translations';

export function Dashboard({ user, onLogout }) {
  const ownerTabs = ['Sites', 'Workers', 'Stock', 'Reports', 'Users', 'Settings'];
  const inchargeTabs = ['Today', 'Workers', 'Stock'];
  const tabs = user.role === 'owner' ? ownerTabs : inchargeTabs;
  const bottomTabs = primaryTabs(user.role, tabs);
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await authApi.logout();
    onLogout();
  }

  function chooseTab(tab) {
    setActiveTab(tab);
    setMenuOpen(false);
  }

  const roleLabel = user.role === 'owner' ? t('nav.owner') : t('nav.siteIncharge');

  return (
    <main className="app-shell">
      <section className="phone-frame dashboard-frame">
        {menuOpen && <button aria-label={t('common.close')} className="drawer-backdrop" onClick={() => setMenuOpen(false)} type="button" />}

        <div className="top-bar">
          <button
            aria-expanded={menuOpen}
            aria-label="Open navigation menu"
            className="menu-button"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
          <div className="header-title">
            <span className="header-eyebrow">{roleLabel}</span>
            <p className="active-section">{tabLabel(activeTab)}</p>
          </div>
        </div>

        <nav className="mobile-bottom-nav" aria-label="Primary navigation">
          {bottomTabs.map((tab) => (
            <button
              aria-current={activeTab === tab ? 'page' : undefined}
              className={activeTab === tab ? 'active' : ''}
              key={tab}
              onClick={() => chooseTab(tab)}
              type="button"
            >
              <TabIcon tab={tab} />
              {tabLabel(tab)}
            </button>
          ))}
        </nav>

        <aside className={`side-drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
          <div className="drawer-header">
            <div>
              <div className="status-pill">{roleLabel}</div>
              <h2>{user.name}</h2>
              <p>{tabLabel(activeTab)}</p>
            </div>
            <button aria-label={t('common.close')} className="drawer-close icon-only" onClick={() => setMenuOpen(false)} type="button">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <nav className="drawer-nav">
            {tabs.map((tab) => (
              <button
                className={activeTab === tab ? 'active' : ''}
                key={tab}
                onClick={() => chooseTab(tab)}
                type="button"
              >
                {tabLabel(tab)}
              </button>
            ))}
          </nav>

          <button className="drawer-logout" onClick={handleLogout} type="button">
            {t('nav.logout')}
          </button>
        </aside>

        {user.role === 'owner' ? (
          <OwnerDashboard activeTab={activeTab} user={user} />
        ) : (
          <SiteInchargeDashboard activeTab={activeTab} user={user} />
        )}
      </section>
    </main>
  );
}

function primaryTabs(role, tabs) {
  const preferred = role === 'owner'
    ? ['Sites', 'Workers', 'Stock', 'Reports']
    : ['Today', 'Workers', 'Stock'];

  return preferred.filter((tab) => tabs.includes(tab));
}

function TabIcon({ tab }) {
  const commonProps = {
    'aria-hidden': 'true',
    fill: 'none',
    height: '20',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '2',
    viewBox: '0 0 24 24',
    width: '20',
  };

  if (tab === 'Sites') {
    return (
      <svg {...commonProps}>
        <path d="M3 21h18" />
        <path d="M5 21V9l7-5 7 5v12" />
        <path d="M9 21v-7h6v7" />
      </svg>
    );
  }

  if (tab === 'Workers') {
    return (
      <svg {...commonProps}>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M20 21v-2a3 3 0 0 0-2-2.83" />
        <path d="M18 3.23a4 4 0 0 1 0 7.54" />
      </svg>
    );
  }

  if (tab === 'Stock') {
    return (
      <svg {...commonProps}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }

  if (tab === 'Reports') {
    return (
      <svg {...commonProps}>
        <path d="M8 3H6a2 2 0 0 0-2 2v16h16V5a2 2 0 0 0-2-2h-2" />
        <path d="M8 3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function OwnerDashboard({ activeTab, user }) {
  if (activeTab === 'Sites') return <OwnerSites />;
  if (activeTab === 'Workers') return <OwnerWorkers />;
  if (activeTab === 'Stock') return <StockManagement role={user.role} />;
  if (activeTab === 'Reports') return <ReportsDashboard role={user.role} />;
  if (activeTab === 'Settings') return <SettingsPanel />;
  return <OwnerUsers />;
}

export function SiteInchargeDashboard({ activeTab, user }) {
  if (activeTab === 'Workers') return <SiteInchargeWorkers />;
  if (activeTab === 'Stock') return <StockManagement role={user.role} />;
  if (activeTab === 'Reports') return <ReportsDashboard role={user.role} />;
  return <AssignedSites />;
}

export function OwnerUsers() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(emptyUserForm());
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError('');

    try {
      setUsers(await usersApi.list());
    } catch (loadError) {
      setError(loadError.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }

  function selectUser(user) {
    setSelectedUser(user);
    setForm({
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      password: '',
    });
    setError('');
    setMessage('');
  }

  function newUser() {
    setSelectedUser(null);
    setForm(emptyUserForm());
    setError('');
    setMessage('');
    setModal('user');
  }

  function editUser(user) {
    selectUser(user);
    setModal('user');
  }

  function confirmDeleteUser(user) {
    selectUser(user);
    setModal('delete-user');
  }

  async function saveUser(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const payload = selectedUser || form.password ? form : { ...form, password: undefined };
      const savedUser = selectedUser
        ? await usersApi.update(selectedUser.id, payload)
        : await usersApi.create(form);

      setSelectedUser(savedUser);
      setForm({ ...savedUser, password: '' });
      setMessage(selectedUser ? t('users.updated') : t('users.created'));
      showToast(selectedUser ? t('users.updated') : t('users.created'));
      await loadUsers();
      setModal(null);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save user.');
    }
  }

  async function deleteSelectedUser() {
    if (!selectedUser) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const deletedUser = await usersApi.delete(selectedUser.id);
      setSelectedUser(null);
      setForm(emptyUserForm());
      setMessage(t('workers.deleted', { name: deletedUser.name }));
      showToast(t('workers.deleted', { name: deletedUser.name }));
      await loadUsers();
      setModal(null);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete user.');
    }
  }

  return (
    <div className="dashboard-body">
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="hint">{t('common.loading')}...</p>}

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>{t('users.title')}</h2>
          </div>
          <button className="new-button" onClick={newUser} type="button">
            <span aria-hidden="true">+</span>
            {t('common.new')}
          </button>
        </div>
        <VisibleList
          items={users}
          loading={loading}
          emptyText={t('users.noUsers')}
          renderItem={(appUser) => (
            <div
              className={`site-card ${selectedUser?.id === appUser.id ? 'selected' : ''}`}
              key={appUser.id}
              onClick={() => selectUser(appUser)}
            >
              <span>{appUser.name}</span>
              <small>{appUser.phone} - {appUser.role} - {appUser.status}</small>
              <span className="inline-actions">
                <button onClick={(event) => { event.stopPropagation(); editUser(appUser); }} type="button">{t('common.edit')}</button>
                <button className="danger-inline-button" onClick={(event) => { event.stopPropagation(); confirmDeleteUser(appUser); }} type="button">{t('common.delete')}</button>
              </span>
            </div>
          )}
        />
      </section>

      {modal === 'user' && (
        <Modal title={selectedUser ? t('users.edit') : t('users.create')} onClose={() => setModal(null)}>
        <form className="login-form compact-form" onSubmit={saveUser}>
          <label>
            {t('common.name')}
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            {t('common.phone')}
            <input
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              required
              type="text"
              value={form.phone}
            />
          </label>
          <label>
            {t('users.role')}
            <select
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              value={form.role}
            >
              <option value="site_incharge">{t('users.siteIncharge')}</option>
              <option value="owner">{t('users.owner')}</option>
            </select>
          </label>
          <label>
            {t('common.status')}
            <select
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              value={form.status}
            >
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
          </label>
          <label>
            {t('common.password')} {selectedUser ? '' : ''}
            <input
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!selectedUser}
              type="password"
              value={form.password}
            />
          </label>
          <button type="submit">{selectedUser ? t('common.saveChanges') : t('users.create')}</button>
        </form>
        </Modal>
      )}

      {modal === 'delete-user' && selectedUser && (
        <Modal title={t('users.deleteTitle')} onClose={() => setModal(null)}>
          <p className="intro">
            {t('users.deleteConfirm')}
          </p>
          <button className="danger-button" onClick={deleteSelectedUser} type="button">
            {t('users.deleteButton')}
          </button>
        </Modal>
      )}
    </div>
  );
}

function tabLabel(tab) {
  const labels = {
    Sites: t('nav.sites'),
    Today: t('nav.today'),
    Workers: t('nav.workers'),
    Stock: t('nav.stock'),
    Reports: t('nav.reports'),
    Users: t('nav.users'),
    Settings: t('nav.settings'),
  };

  return labels[tab] || tab;
}

function emptyUserForm() {
  return {
    name: '',
    phone: '',
    role: 'site_incharge',
    status: 'active',
    password: '',
  };
}

export function ProfilePanel({ user }) {
  return (
    <div className="dashboard-body">
      <section className="panel">
        <h2>Profile</h2>
        <div className="status-list">
          <div className="status-row"><span>Name</span><strong>{user.name}</strong></div>
          <div className="status-row"><span>Phone</span><strong>{user.phone}</strong></div>
          <div className="status-row"><span>Role</span><strong>{user.role}</strong></div>
        </div>
      </section>
    </div>
  );
}
