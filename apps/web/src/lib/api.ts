import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Let the browser set Content-Type (with boundary) for multipart uploads
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// Auth
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data).then((r) => r.data),
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/change-password', data).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }).then((r) => r.data),
};

// Company
export const companyApi = {
  get: () => api.get('/company').then((r) => r.data),
  update: (data: { name?: string }) => api.patch('/company', data).then((r) => r.data),
};

// Projects
export const projectsApi = {
  list: () => api.get('/projects').then((r) => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/projects', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data).then((r) => r.data),
  addMember: (id: string, data: any) => api.post(`/projects/${id}/members`, data).then((r) => r.data),
  analytics: (id: string) => api.get(`/projects/${id}/analytics`).then((r) => r.data),
};

// Sprints
export const sprintsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/sprints`).then((r) => r.data),
  get: (projectId: string, id: string) => api.get(`/projects/${projectId}/sprints/${id}`).then((r) => r.data),
  stats: (projectId: string, id: string) => api.get(`/projects/${projectId}/sprints/${id}/stats`).then((r) => r.data),
  create: (projectId: string, data: any) => api.post(`/projects/${projectId}/sprints`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: any) => api.patch(`/projects/${projectId}/sprints/${id}`, data).then((r) => r.data),
};

// Issues
export const issuesApi = {
  list: (projectId: string, sprintId?: string) =>
    api.get(`/projects/${projectId}/issues`, { params: sprintId ? { sprintId } : {} }).then((r) => r.data),
  backlog: (projectId: string) => api.get(`/projects/${projectId}/issues/backlog`).then((r) => r.data),
  get: (projectId: string, id: string) => api.get(`/projects/${projectId}/issues/${id}`).then((r) => r.data),
  create: (projectId: string, data: any) => api.post(`/projects/${projectId}/issues`, data).then((r) => r.data),
  bulkCreate: (projectId: string, issues: any[]) => api.post(`/projects/${projectId}/issues/bulk`, { issues }).then((r) => r.data),
  update: (projectId: string, id: string, data: any) => api.patch(`/projects/${projectId}/issues/${id}`, data).then((r) => r.data),
  remove: (projectId: string, id: string) => api.delete(`/projects/${projectId}/issues/${id}`).then((r) => r.data),
  move: (projectId: string, id: string, data: { status: string; position: number }) =>
    api.patch(`/projects/${projectId}/issues/${id}/move`, data).then((r) => r.data),
  comment: (projectId: string, id: string, body: string) =>
    api.post(`/projects/${projectId}/issues/${id}/comments`, { body }).then((r) => r.data),
};

// HR
export const hrApi = {
  leave: {
    list: (params?: any) => api.get('/hr/leave', { params }).then((r) => r.data),
    mine: () => api.get('/hr/leave/mine').then((r) => r.data),
    summary: () => api.get('/hr/leave/summary').then((r) => r.data),
    create: (data: any) => api.post('/hr/leave', data).then((r) => r.data),
    approve: (id: string, note?: string) => api.patch(`/hr/leave/${id}/approve`, { note }).then((r) => r.data),
    reject: (id: string, note?: string) => api.patch(`/hr/leave/${id}/reject`, { note }).then((r) => r.data),
  },
  announcements: {
    list: () => api.get('/hr/announcements').then((r) => r.data),
    create: (data: any) => api.post('/hr/announcements', data).then((r) => r.data),
  },
  standupNotes: {
    list: (date: string) => api.get('/hr/standup-notes', { params: { date } }).then((r) => r.data),
    byProject: (projectId: string, params?: { dateFrom?: string; dateTo?: string }) =>
      api.get(`/hr/standup-notes/project/${projectId}`, { params }).then((r) => r.data),
    save: (
      subjectUserId: string,
      data: { standup_date: string; content: string; project_id: string },
    ) =>
      api.put(`/hr/standup-notes/${subjectUserId}`, data).then((r) => r.data),
    remove: (id: string) => api.delete(`/hr/standup-notes/${id}`).then((r) => r.data),
  },
};

// Docs
export const docsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/docs`).then((r) => r.data),
  get: (projectId: string, id: string) => api.get(`/projects/${projectId}/docs/${id}`).then((r) => r.data),
  create: (projectId: string, data: { title: string; content?: string }) =>
    api.post(`/projects/${projectId}/docs`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: { title?: string; content?: string }) =>
    api.patch(`/projects/${projectId}/docs/${id}`, data).then((r) => r.data),
  remove: (projectId: string, id: string) => api.delete(`/projects/${projectId}/docs/${id}`).then((r) => r.data),
};

// Users / Employees
export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data).then((r) => r.data),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/users/avatar', fd).then((r) => r.data);
  },
  getInvite: (token: string) => api.get(`/users/onboarding?token=${token}`).then((r) => r.data),
  completeOnboarding: (data: any) => api.post('/users/onboarding', data).then((r) => r.data),
  uploadOnboardingFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/users/onboarding/upload', fd).then((r) => r.data);
  },
};

// Leave Packages
export const leavePackagesApi = {
  list: () => api.get('/hr/leave-packages').then((r) => r.data),
  get: (id: string) => api.get(`/hr/leave-packages/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/hr/leave-packages', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/hr/leave-packages/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/hr/leave-packages/${id}`).then((r) => r.data),
  allocate: (id: string, userIds: string[] | 'all') =>
    api.post(`/hr/leave-packages/${id}/allocate`, { userIds }).then((r) => r.data),
  removeAllocation: (id: string, userId: string) =>
    api.delete(`/hr/leave-packages/${id}/allocate/${userId}`).then((r) => r.data),
  myBalance: () => api.get('/hr/leave-packages/balance').then((r) => r.data),
  balance: (userId: string) => api.get(`/hr/leave-packages/balance/${userId}`).then((r) => r.data),
};

// Departments
export const departmentsApi = {
  list: () => api.get('/departments').then((r) => r.data),
  create: (data: { name: string; manager_id?: string }) => api.post('/departments', data).then((r) => r.data),
  update: (id: string, data: { name?: string; manager_id?: string }) => api.patch(`/departments/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/departments/${id}`).then((r) => r.data),
};

// Performance Reviews
export const performanceApi = {
  list: (params?: { reviewee_id?: string; date_from?: string; date_to?: string }) =>
    api.get('/hr/performance', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/hr/performance/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/hr/performance', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/hr/performance/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/hr/performance/${id}`).then((r) => r.data),
  contributions: (userId: string, params?: { date_from?: string; date_to?: string }) =>
    api.get(`/hr/performance/contributions/${userId}`, { params }).then((r) => r.data),
};

// Notifications
export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

// HR Reports
export const reportsApi = {
  employee: (params: { userId: string; dateFrom: string; dateTo: string }) =>
    api.get('/hr/reports/employee', { params }).then((r) => r.data),
  department: (params: { departmentId: string; dateFrom: string; dateTo: string }) =>
    api.get('/hr/reports/department', { params }).then((r) => r.data),
};

// Project Files
export const filesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/files`).then((r) => r.data),
  upload: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/projects/${projectId}/files`, fd).then((r) => r.data);
  },
  remove: (projectId: string, fileId: string) =>
    api.delete(`/projects/${projectId}/files/${fileId}`).then((r) => r.data),
};

// Clients
export const clientsApi = {
  list: (search?: string) => api.get('/clients', { params: search ? { search } : {} }).then((r) => r.data),
  get: (id: string) => api.get(`/clients/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/clients', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/clients/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/clients/${id}`).then((r) => r.data),
  linkProject: (id: string, projectId: string) => api.post(`/clients/${id}/projects/${projectId}`).then((r) => r.data),
  unlinkProject: (id: string, projectId: string) => api.delete(`/clients/${id}/projects/${projectId}`).then((r) => r.data),
};

// Newsletters
export const newslettersApi = {
  list: () => api.get('/newsletters').then((r) => r.data),
  get: (id: string) => api.get(`/newsletters/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/newsletters', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/newsletters/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/newsletters/${id}`).then((r) => r.data),
  send: (id: string, recipients: Array<{ email: string; name?: string }>) =>
    api.post(`/newsletters/${id}/send`, { recipients }).then((r) => r.data),
  getSends: (id: string) => api.get(`/newsletters/${id}/sends`).then((r) => r.data),
};

// Chat
export const chatApi = {
  getConversations: () => api.get('/chat/conversations').then((r) => r.data),
  startDirect: (userId: string) => api.post('/chat/conversations/direct', { userId }).then((r) => r.data),
  startDepartment: (departmentId: string) => api.post('/chat/conversations/department', { departmentId }).then((r) => r.data),
  startProject: (projectId: string) => api.post('/chat/conversations/project', { projectId }).then((r) => r.data),
  getPresence: () => api.get('/chat/presence').then((r) => r.data),
  getMessages: (convId: string) => api.get(`/chat/conversations/${convId}/messages`).then((r) => r.data),
  sendMessage: (convId: string, content: string) => api.post(`/chat/conversations/${convId}/messages`, { content }).then((r) => r.data),
  markRead: (convId: string) => api.post(`/chat/conversations/${convId}/read`).then((r) => r.data),
  getUnread: () => api.get('/chat/unread').then((r) => r.data),
  getUsers: () => api.get('/chat/users').then((r) => r.data),
  getDepartments: () => api.get('/chat/departments').then((r) => r.data),
};
