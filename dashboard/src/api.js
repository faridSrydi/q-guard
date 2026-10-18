/**
 * Q-GUARD API Client
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = localStorage.getItem('qguard_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errData = await response.json();
                if (errData.error) errorMsg = errData.error;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        return await response.json();
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

export const api = {
    // Health & System
    getHealth: () => request('/health'),

    // Devices
    getDevices: () => request('/devices'),
    getDevice: (id) => request(`/devices/${id}`),
    createDevice: (data) => request('/devices', { method: 'POST', body: JSON.stringify(data) }),
    getLatestReading: (deviceId) => request(`/devices/${deviceId}/latest`),

    // Shipments
    getShipments: (status) => request(`/shipments${status ? `?status=${status}` : ''}`),
    getShipment: (id) => request(`/shipments/${id}`),
    createShipment: (data) => request('/shipments', { method: 'POST', body: JSON.stringify(data) }),
    updateShipment: (id, data) => request(`/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteShipment: (id) => request(`/shipments/${id}`, { method: 'DELETE' }),
    getShipmentReadings: (id, limit = 100, order = 'DESC') => request(`/shipments/${id}/readings?limit=${limit}&order=${order}`),

    // Sensor Data
    getLatest: (deviceId, shipmentId) => {
        let q = [];
        if (deviceId) q.push(`device_id=${deviceId}`);
        if (shipmentId) q.push(`shipment_id=${shipmentId}`);
        return request(`/sensor-data/latest${q.length ? `?${q.join('&')}` : ''}`);
    },
    getHistory: (params = {}) => {
        const search = new URLSearchParams(params).toString();
        return request(`/sensor-data/history?${search}`);
    },
    uploadBatch: (payload) => request('/sensor-data/batch', { method: 'POST', body: JSON.stringify(payload) }),
    clearSensorData: (deviceId) => request(`/sensor-data/clear${deviceId ? `?device_id=${deviceId}` : ''}`, { method: 'DELETE' }),

    // Risk Engine
    getRiskSummary: () => request('/risk/summary'),
    getRiskEvaluation: (shipmentId) => request(`/risk/evaluate/${shipmentId}`),

    // Alerts
    getAlerts: (params = {}) => {
        const search = new URLSearchParams(params).toString();
        return request(`/alerts?${search}`);
    },
    getAlertSummary: () => request('/alerts/summary'),
    acknowledgeAlert: (id) => request(`/alerts/${id}/ack`, { method: 'POST' }),

    // Audit & Reports
    getAuditReport: (shipmentId) => request(`/reports/shipment/${shipmentId}`),
    getSystemSummary: () => request('/reports/summary'),

    // Configurations
    getConfigs: () => request('/config'),
    updateConfig: (key, value) => request(`/config/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

    // Authentication
    login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' })
};
