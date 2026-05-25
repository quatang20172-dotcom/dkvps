import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
});

// Response interceptor - handle 401
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth
export const login = (username, password) => api.post('/auth/login', { username, password });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const changePassword = (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword });

// Domains
export const getDomains = () => api.get('/domains');
export const getDomain = (domain) => api.get(`/domains/${domain}`);
export const addDomain = (data) => api.post('/domains', data);
export const deleteDomain = (domain) => api.delete(`/domains/${domain}`);
export const suspendDomain = (domain) => api.post(`/domains/${domain}/suspend`);
export const unsuspendDomain = (domain) => api.post(`/domains/${domain}/unsuspend`);

// Databases
export const getDatabases = () => api.get('/databases');
export const getDatabase = (name) => api.get(`/databases/${name}`);
export const createDatabase = (data) => api.post('/databases', data);
export const deleteDatabase = (name) => api.delete(`/databases/${name}`);
export const exportDatabase = (name) => api.post(`/databases/${name}/export`);

// Monitor
export const getStatus = () => api.get('/monitor/status');
export const getProcesses = () => api.get('/monitor/processes');
export const getDisk = () => api.get('/monitor/disk');
export const getAuditLog = (limit) => api.get(`/monitor/audit-log?limit=${limit || 100}`);

// Services
export const getServices = () => api.get('/services');
export const controlService = (service, action) => api.post(`/services/${service}/${action}`);

// PHP
export const getPhpInfo = () => api.get('/php/info');
export const changePhpVersion = (version) => api.post('/php/version', { version });

// SSL
export const getCertificates = () => api.get('/ssl');
export const installSSL = (domain, provider) => api.post('/ssl/install', { domain, provider });
export const renewSSL = (domain) => api.post('/ssl/renew', { domain });

// Firewall
export const getFirewallStatus = () => api.get('/firewall/status');
export const openPort = (port, protocol) => api.post('/firewall/open', { port, protocol });
export const closePort = (port, protocol) => api.post('/firewall/close', { port, protocol });

// Backup
export const getBackups = () => api.get('/backup');
export const createBackup = (domain, type) => api.post('/backup/create', { domain, type });
export const deleteBackup = (filename) => api.delete(`/backup/${filename}`);

// Cache
export const getCacheStatus = () => api.get('/cache/status');
export const flushRedis = () => api.post('/cache/redis/flush');
export const resetOpcache = () => api.post('/cache/opcache/reset');
export const clearAllCache = () => api.post('/cache/clear-all');

// WordPress
export const installWordPress = (domain) => api.post('/wordpress/install', { domain });
export const updateWordPress = (domain) => api.post('/wordpress/update', { domain });
export const clearWpCache = (domain) => api.post('/wordpress/clear-cache', { domain });
