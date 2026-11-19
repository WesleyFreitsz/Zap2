import axios from "axios";

const API_BASE_URL = "/api";

const buildRequestConfig = (data) =>
  data instanceof FormData ? {} : undefined;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle 401 and auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = data.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

// ============ AUTH ============
export const authApi = {
  login: (email, password) =>
    apiClient.post("/auth/login", { email, password }).then((r) => r.data.data),
  register: (data) =>
    apiClient.post("/auth/register", data).then((r) => r.data.data),
  refresh: (refreshToken) =>
    apiClient.post("/auth/refresh", { refreshToken }).then((r) => r.data.data),
};

// ============ USERS (Employees) ============
export const usersApi = {
  list: () => apiClient.get("/users").then((r) => r.data.data),
  getById: (id) => apiClient.get(`/users/${id}`).then((r) => r.data.data),
  create: (data) => apiClient.post("/users", data).then((r) => r.data.data),
  update: (id, data) =>
    apiClient.put(`/users/${id}`, data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/users/${id}`).then((r) => r.data),
  getProfile: () => apiClient.get("/users/profile").then((r) => r.data.data),
  updateProfile: (data) =>
    apiClient.put("/users/profile", data).then((r) => r.data.data),
  changePassword: (data) =>
    apiClient.post("/users/change-password", data).then((r) => r.data.data),
};

// ============ CONVERSATIONS ============
export const conversationsApi = {
  list: (params) =>
    apiClient.get("/conversations", { params }).then((r) => r.data.data),
  getById: (id) =>
    apiClient.get(`/conversations/${id}`).then((r) => r.data.data),
  create: (data) =>
    apiClient.post("/conversations", data).then((r) => r.data.data),
  update: (id, data) =>
    apiClient.put(`/conversations/${id}`, data).then((r) => r.data.data),
  assign: (data) =>
    apiClient.post("/conversations/assign", data).then((r) => r.data.data),
  transfer: (data) =>
    apiClient.post("/conversations/transfer", data).then((r) => r.data.data),
  close: (id) =>
    apiClient.patch(`/conversations/${id}/close`).then((r) => r.data.data),
  createLead: (id) =>
    apiClient.post(`/conversations/${id}/create-lead`).then((r) => r.data.data),
};

// ============ MESSAGES ============
export const messagesApi = {
  list: (conversationId) =>
    apiClient.get(`/messages/${conversationId}`).then((r) => r.data.data),
  send: (data) =>
    apiClient.post("/messages/send", data).then((r) => r.data.data),
  sendTemplate: (data) =>
    apiClient.post("/messages/send-template", data).then((r) => r.data.data),
  suggestReply: (conversationId) =>
    apiClient
      .post("/messages/suggest-reply", { conversationId })
      .then((r) => r.data.data.suggestion),
};

// ============ PRODUCTS ============
export const productsApi = {
  list: () => apiClient.get("/products").then((r) => r.data.data),
  getById: (id) => apiClient.get(`/products/${id}`).then((r) => r.data.data),
  create: (data) =>
    apiClient
      .post("/products", data, buildRequestConfig(data))
      .then((r) => r.data.data),
  update: (id, data) =>
    apiClient
      .put(`/products/${id}`, data, buildRequestConfig(data))
      .then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/products/${id}`).then((r) => r.data),
  sendToChat: (data) =>
    apiClient.post("/products/send-to-chat", data).then((r) => r.data.data),
};

// ============ SCHEDULE ============
export const scheduleApi = {
  list: () => apiClient.get("/schedule").then((r) => r.data.data),
  create: (data) => apiClient.post("/schedule", data).then((r) => r.data.data),
  update: (id, data) =>
    apiClient.put(`/schedule/${id}`, data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/schedule/${id}`).then((r) => r.data),
};

// ============ DASHBOARD ============
export const dashboardApi = {
  overview: () => apiClient.get("/dashboard/overview").then((r) => r.data.data),
  getStats: () => apiClient.get("/dashboard/stats").then((r) => r.data.data),
  ranking: () => apiClient.get("/dashboard/ranking").then((r) => r.data.data),
  myStats: () => apiClient.get("/dashboard/my-stats").then((r) => r.data.data),
  weeklyActivity: () => apiClient.get("/dashboard/weekly-activity").then((r) => r.data.data),
};

export const channelsApi = {
  list: () => apiClient.get("/channels").then((r) => r.data.data),
  whatsappTemplates: (channelId, refresh = false) =>
    apiClient
      .get(`/channels/${channelId}/whatsapp-templates`, {
        params: refresh ? { refresh: true } : undefined,
      })
      .then((r) => r.data.data),
  metaConfig: () => apiClient.get("/channels/meta/config").then((r) => r.data.data),
  discoverPages: (code) =>
    apiClient.post("/channels/meta/pages/discover", { code }).then((r) => r.data.data),
  connectPages: (data) =>
    apiClient.post("/channels/meta/pages/connect", data).then((r) => r.data.data),
  connectWhatsAppCloud: (data) =>
    apiClient.post("/channels/whatsapp-cloud/connect", data).then((r) => r.data.data),
  connectManual: (data) =>
    apiClient.post("/channels/meta/manual", data).then((r) => r.data.data),
  remove: (id) => apiClient.delete(`/channels/${id}`),
};

// ============ WHATSAPP (multi-session) ============
export const whatsappApi = {
  // List all sessions for current company
  sessions: () =>
    apiClient.get("/integrations/whatsapp/sessions").then((r) => r.data.data),
  // Create new session (validates plan limit)
  connect: (label) =>
    apiClient
      .post("/integrations/whatsapp/connect", { label })
      .then((r) => r.data.data),
  // Status of specific session
  status: (integrationId) =>
    apiClient
      .get(`/integrations/whatsapp/status/${integrationId}`)
      .then((r) => r.data.data),
  // QR code of specific session
  qrcode: (integrationId) =>
    apiClient
      .get(`/integrations/whatsapp/qrcode/${integrationId}`)
      .then((r) => r.data.data),
  // Reconnect specific session
  reconnect: (integrationId) =>
    apiClient
      .post(`/integrations/whatsapp/reconnect/${integrationId}`)
      .then((r) => r.data.data),
  // Disconnect specific session
  disconnect: (integrationId) =>
    apiClient
      .post(`/integrations/whatsapp/disconnect/${integrationId}`)
      .then((r) => r.data.data),
  // Send message (integrationId optional, auto-selects if omitted)
  send: (data) =>
    apiClient
      .post("/integrations/whatsapp/send", data)
      .then((r) => r.data.data),
};

// ============ AI CONFIG ============
export const aiConfigApi = {
  get: () => apiClient.get("/ai-config").then((r) => r.data.data),
  save: (data) => apiClient.put("/ai-config", data).then((r) => r.data.data),
};

export const quickRepliesApi = {
  list: () => apiClient.get("/quick-replies").then((r) => r.data.data),
  create: (data) => apiClient.post("/quick-replies", data).then((r) => r.data.data),
  update: (id, data) => apiClient.put(`/quick-replies/${id}`, data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/quick-replies/${id}`),
};

export function quickRepliesQuery(companyId) {
  return {
    queryKey: ["quick-replies", companyId],
    queryFn: quickRepliesApi.list,
    staleTime: 5 * 60 * 1000,
  };
}

// ============ TAGS ============
export const tagsApi = {
  list: () => apiClient.get("/tags").then((r) => r.data.data),
  create: (data) => apiClient.post("/tags", data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/tags/${id}`).then((r) => r.data),
  forConversation: (conversationId) =>
    apiClient.get(`/tags/conversation/${conversationId}`).then((r) => r.data.data),
  assign: (conversationId, tagId) =>
    apiClient.post("/tags/assign", { conversationId, tagId }).then((r) => r.data.data),
  unassign: (conversationId, tagId) =>
    apiClient
      .delete(`/tags/conversation/${conversationId}/tag/${tagId}`)
      .then((r) => r.data),
};

// ============ SETTINGS / PROFILE ============
export const settingsApi = {
  getProfile: () => apiClient.get("/settings/profile").then((r) => r.data.data),
  updateProfile: (data) =>
    apiClient.put("/settings/profile", data).then((r) => r.data.data),
  getCompany: () => apiClient.get("/settings/company").then((r) => r.data.data),
  updateCompany: (data) =>
    apiClient.put("/settings/company", data).then((r) => r.data.data),
};

// ============ LEADS ============
export const leadsApi = {
  list: (params) =>
    apiClient.get("/leads", { params }).then((r) => r.data.data),
  getById: (id) => apiClient.get(`/leads/${id}`).then((r) => r.data.data),
  create: (data) => apiClient.post("/leads", data).then((r) => r.data.data),
  update: (id, data) =>
    apiClient.put(`/leads/${id}`, data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/leads/${id}`).then((r) => r.data),
  request: (url, options = {}) => {
    const method = options.method || 'GET';
    const config = {
      ...options,
      url,
      method,
    };

    if (method === 'GET') {
      return apiClient.get(url).then(r => r.data.data);
    } else if (method === 'POST') {
      return apiClient.post(url, options.data).then(r => r.data.data);
    } else if (method === 'PUT') {
      return apiClient.put(url, options.data).then(r => r.data.data);
    } else if (method === 'DELETE') {
      return apiClient.delete(url).then(r => r.data.data);
    } else {
      return apiClient(config).then(r => r.data.data);
    }
  },
};

// ============ INVITATIONS ============
export const invitationsApi = {
  list: () => apiClient.get("/invitations").then((r) => r.data.data),
  send: (data) => apiClient.post("/invitations", data).then((r) => r.data.data),
  getByToken: (token) =>
    apiClient.get(`/invitations/token/${token}`).then((r) => r.data.data),
  revoke: (id) => apiClient.delete(`/invitations/${id}`).then((r) => r.data),
};

// ============ BILLING ============
export const billingApi = {
  getSubscription: () =>
    apiClient.get("/billing/subscription").then((r) => r.data.data),
  getInvoices: () =>
    apiClient.get("/billing/invoices").then((r) => r.data.data),
  createSubscription: (data) =>
    apiClient.post("/billing/subscriptions", data).then((r) => r.data.data),
};

// ============ PLANS ============
export const plansApi = {
  list: (params) =>
    apiClient.get("/plans", { params }).then((r) => r.data.data),
  getBySlug: (slug) => apiClient.get(`/plans/${slug}`).then((r) => r.data.data),
  create: (data) => apiClient.post("/plans", data).then((r) => r.data.data),
  update: (id, data) =>
    apiClient.put(`/plans/${id}`, data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/plans/${id}`).then((r) => r.data),
};

// ============ ADMIN DASHBOARD (SUPER_ADMIN) ============
export const adminApi = {
  dashboard: () => apiClient.get("/admin/dashboard").then((r) => r.data.data),
  companies: () => apiClient.get("/companies").then((r) => r.data.data),
  getCompany: (id) =>
    apiClient.get(`/companies/${id}`).then((r) => r.data.data),
  updateCompany: (id, data) =>
    apiClient.put(`/companies/${id}`, data).then((r) => r.data.data),
  createCompany: (data) =>
    apiClient.post("/admin/companies", data).then((r) => r.data.data),
  toggleCompany: (id) =>
    apiClient.patch(`/companies/${id}/toggle`).then((r) => r.data.data),
  uploadLogo: (companyId, formData) =>
    apiClient
      .post(`/companies/${companyId}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.data),
};
