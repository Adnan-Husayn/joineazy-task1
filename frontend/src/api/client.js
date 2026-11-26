const RAW_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

const TOKEN_STORAGE_KEY = 'joineazy_auth_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

let onUnauthorizedHandler = null;
export function setOnUnauthorized(handler) {
  onUnauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let payload = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    if (response.status === 401 && token && onUnauthorizedHandler) {
      onUnauthorizedHandler();
    }
    throw new ApiError(
      payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload?.details || null
    );
  }

  return payload;
}

export const authApi = {
  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
};

export const coursesApi = {
  list: () => request('/courses'),
  get: (id) => request(`/courses/${id}`),
  create: (data) =>
    request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  enroll: (courseId, identifier) =>
    request(`/courses/${courseId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),
};

export const groupsApi = {
  list: () => request('/groups'),
  get: (id) => request(`/groups/${id}`),
  create: (data) =>
    request('/groups', { method: 'POST', body: JSON.stringify(data) }),
  addMember: (groupId, identifier) =>
    request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),
  removeMember: (groupId, userId) =>
    request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  delete: (groupId) =>
    request(`/groups/${groupId}`, { method: 'DELETE' }),
};

export const assignmentsApi = {
  list: (courseId) => {
    const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
    return request(`/assignments${qs}`);
  },
  get: (id) => request(`/assignments/${id}`),
  create: (data) =>
    request('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) =>
    request(`/assignments/${id}`, { method: 'DELETE' }),
};

export const submissionsApi = {
  confirm: (data) =>
    request('/submissions/confirm', { method: 'POST', body: JSON.stringify(data) }),
  studentProgress: () => request('/submissions/progress'),
  tracking: (params = {}) => {
    const query = new URLSearchParams();
    if (params.courseId) query.set('courseId', params.courseId);
    if (params.assignmentId) query.set('assignmentId', params.assignmentId);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    return request(`/submissions/tracking${qs ? `?${qs}` : ''}`);
  },
  analytics: () => request('/submissions/analytics'),
};
