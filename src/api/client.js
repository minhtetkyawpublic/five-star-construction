const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/five-star-construction/server/public/index.php';
const TOKEN_KEY = 'five_star_auth_token';

function normalizePath(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getAuthToken();

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${normalizePath(path)}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw {
      code: 'CONNECTION_ERROR',
      message: 'Cannot connect to the server. Please check your internet connection.',
    };
  }

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw {
        code: 'INVALID_RESPONSE',
        message: 'The server returned an invalid response. Please check PHP and MySQL in XAMPP.',
      };
    }
  }

  if (!response.ok || payload?.success === false) {
    const error = payload?.error || {
      code: 'REQUEST_FAILED',
      message: 'Request failed.',
    };

    throw error;
  }

  if (!payload) {
    throw {
      code: 'EMPTY_RESPONSE',
      message: 'The server returned an empty response.',
    };
  }

  return payload;
}

export const apiClient = {
  get(path) {
    return request(path, { method: 'GET' });
  },
  post(path, body) {
    return request(path, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  },
};

export const authApi = {
  async login(phone, password) {
    const response = await apiClient.post('/api/login', { phone, password });
    setAuthToken(response.data.token);
    return response.data.user;
  },
  async me() {
    const response = await apiClient.get('/api/me');
    return response.data.user;
  },
  async logout() {
    try {
      await apiClient.post('/api/logout');
    } finally {
      clearAuthToken();
    }
  },
};

export const sitesApi = {
  async list() {
    const response = await apiClient.get('/api/sites');
    return response.data.sites;
  },
  async get(id) {
    const response = await apiClient.get(`/api/sites/${id}`);
    return response.data.site;
  },
  async create(site) {
    const response = await apiClient.post('/api/sites', site);
    return response.data.site;
  },
  async update(id, site) {
    const response = await apiClient.post(`/api/sites/${id}`, site);
    return response.data.site;
  },
  async assignIncharges(id, userIds) {
    const response = await apiClient.post(`/api/sites/${id}/incharges`, { user_ids: userIds });
    return response.data.site;
  },
  async delete(id) {
    const response = await apiClient.post(`/api/sites/${id}/delete`);
    return response.data.site;
  },
};

export const siteInchargesApi = {
  async list() {
    const response = await apiClient.get('/api/site-incharges');
    return response.data.site_incharges;
  },
  async create(user) {
    const response = await apiClient.post('/api/site-incharges', user);
    return response.data.site_incharge;
  },
};

export const usersApi = {
  async list() {
    const response = await apiClient.get('/api/users');
    return response.data.users;
  },
  async get(id) {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data.user;
  },
  async create(user) {
    const response = await apiClient.post('/api/users', user);
    return response.data.user;
  },
  async update(id, user) {
    const response = await apiClient.post(`/api/users/${id}`, user);
    return response.data.user;
  },
  async deactivate(id) {
    const response = await apiClient.post(`/api/users/${id}/delete`);
    return response.data.user;
  },
  async delete(id) {
    const response = await apiClient.post(`/api/users/${id}/delete`);
    return response.data.user;
  },
};

export const workersApi = {
  async list() {
    const response = await apiClient.get('/api/workers');
    return response.data.workers;
  },
  async get(id) {
    const response = await apiClient.get(`/api/workers/${id}`);
    return response.data.worker;
  },
  async create(worker) {
    const response = await apiClient.post('/api/workers', worker);
    return response.data.worker;
  },
  async update(id, worker) {
    const response = await apiClient.post(`/api/workers/${id}`, worker);
    return response.data.worker;
  },
  async assignSites(id, siteIds) {
    const response = await apiClient.post(`/api/workers/${id}/sites`, { site_ids: siteIds });
    return response.data.worker;
  },
  async delete(id) {
    const response = await apiClient.post(`/api/workers/${id}/delete`);
    return response.data.worker;
  },
  async listForSite(siteId) {
    const response = await apiClient.get(`/api/sites/${siteId}/workers`);
    return response.data.workers;
  },
  async attendance(id, month) {
    const response = await apiClient.get(`/api/workers/${id}/attendance?month=${encodeURIComponent(month)}`);
    return response.data.attendance;
  },
};

export const attendanceApi = {
  async list(params = {}) {
    const query = new URLSearchParams();

    if (params.date) {
      query.set('date', params.date);
    }

    if (params.site_id) {
      query.set('site_id', params.site_id);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get(`/api/daily-reports${suffix}`);
    return response.data.daily_reports;
  },
  async save(report) {
    const response = await apiClient.post('/api/daily-reports', report);
    return response.data.daily_report;
  },
  async get(id) {
    const response = await apiClient.get(`/api/daily-reports/${id}`);
    return response.data.daily_report;
  },
  async getForSiteDate(siteId, date) {
    const response = await apiClient.get(`/api/sites/${siteId}/daily-report?date=${encodeURIComponent(date)}`);
    return response.data.daily_report;
  },
};

export const workerPaymentsApi = {
  async list(params = {}) {
    const query = new URLSearchParams();

    if (params.site_id) {
      query.set('site_id', params.site_id);
    }

    if (params.worker_id) {
      query.set('worker_id', params.worker_id);
    }

    if (params.date) {
      query.set('date', params.date);
    }

    if (params.type) {
      query.set('type', params.type);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get(`/api/worker-payments${suffix}`);
    return response.data.worker_payments;
  },
  async create(payment) {
    const response = await apiClient.post('/api/worker-payments', payment);
    return response.data.worker_payment;
  },
  async listForWorker(workerId) {
    const response = await apiClient.get(`/api/workers/${workerId}/payments`);
    return response.data.worker_payments;
  },
};

export const reportsApi = {
  async monthlyWorkers(params = {}) {
    const query = new URLSearchParams();
    if (params.month) query.set('month', params.month);
    if (params.site_id) query.set('site_id', params.site_id);
    const response = await apiClient.get(`/api/reports/workers/monthly?${query.toString()}`);
    return response.data.report;
  },
  async monthlyStock(params = {}) {
    const query = new URLSearchParams();
    if (params.month) query.set('month', params.month);
    if (params.site_id) query.set('site_id', params.site_id);
    const response = await apiClient.get(`/api/reports/stock/monthly?${query.toString()}`);
    return response.data.report;
  },
};

export const reportLockingApi = {
  async settings() {
    const response = await apiClient.get('/api/report-settings');
    return response.data.settings;
  },
  async saveSetting(setting) {
    const response = await apiClient.post('/api/report-settings', setting);
    return response.data.setting;
  },
  async editRequests() {
    const response = await apiClient.get('/api/report-edit-requests');
    return response.data.edit_requests;
  },
  async createEditRequest(request) {
    const response = await apiClient.post('/api/report-edit-requests', request);
    return response.data.edit_request;
  },
  async review(id, status) {
    const response = await apiClient.post(`/api/report-edit-requests/${id}/review`, { status });
    return response.data.edit_request;
  },
};

export const stockApi = {
  async items() {
    const response = await apiClient.get('/api/stock-items');
    return response.data.stock_items;
  },
  async createItem(item) {
    const response = await apiClient.post('/api/stock-items', item);
    return response.data.stock_item;
  },
  async cashTransfer(transfer) {
    const response = await apiClient.post('/api/cash-transfers', transfer);
    return response.data.cash_transfer;
  },
  async purchase(purchase) {
    const response = await apiClient.post('/api/stock-purchases', purchase);
    return response.data.stock_purchase;
  },
  async usage(usage) {
    const response = await apiClient.post('/api/stock-usage', usage);
    return response.data.stock_usage;
  },
  async balances(params = {}) {
    const query = new URLSearchParams();
    if (params.site_id) query.set('site_id', params.site_id);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get(`/api/stock-balances${suffix}`);
    return response.data.stock_balances;
  },
};
