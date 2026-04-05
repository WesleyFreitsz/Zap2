import axios from "axios";

const API_BASE_URL = "/api";

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
};

// ============ MESSAGES ============
export const messagesApi = {
  list: (conversationId) =>
    apiClient.get(`/messages/${conversationId}`).then((r) => r.data.data),
  send: (data) =>
    apiClient.post("/messages/send", data).then((r) => r.data.data),
};

// ============ PRODUCTS ============
export const productsApi = {
  list: () => apiClient.get("/products").then((r) => r.data.data),
  getById: (id) => apiClient.get(`/products/${id}`).then((r) => r.data.data),
  create: (data) => apiClient.post("/products", data).then((r) => r.data.data),
  update: (id, data) =>
    apiClient.put(`/products/${id}`, data).then((r) => r.data.data),
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
};

// ============ INTEGRATIONS ============
export const integrationsApi = {
  list: () => apiClient.get("/integrations").then((r) => r.data.data),
  create: (data) =>
    apiClient.post("/integrations", data).then((r) => r.data.data),
  toggle: (id) =>
    apiClient.patch(`/integrations/${id}/toggle`).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/integrations/${id}`).then((r) => r.data),
};

// ============ WHATSAPP ============
export const whatsappApi = {
  getConfig: () =>
    apiClient.get("/integrations/whatsapp/config").then((r) => r.data.data),
  saveConfig: (data) =>
    apiClient
      .put("/integrations/whatsapp/config", data)
      .then((r) => r.data.data),
  connect: () =>
    apiClient.post("/integrations/whatsapp/connect").then((r) => r.data.data),
  status: () =>
    apiClient.get("/integrations/whatsapp/status").then((r) => r.data.data),
  qrcode: () =>
    apiClient.get("/integrations/whatsapp/qrcode").then((r) => r.data.data),
  reconnect: () =>
    apiClient.post("/integrations/whatsapp/reconnect").then((r) => r.data.data),
  disconnect: () =>
    apiClient
      .post("/integrations/whatsapp/disconnect")
      .then((r) => r.data.data),
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

// ============ TAGS ============
export const tagsApi = {
  list: () => apiClient.get("/tags").then((r) => r.data.data),
  create: (data) => apiClient.post("/tags", data).then((r) => r.data.data),
  delete: (id) => apiClient.delete(`/tags/${id}`).then((r) => r.data),
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
