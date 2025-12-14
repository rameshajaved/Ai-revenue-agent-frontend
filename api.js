/**
 * API Client for Revenue Integrity Dashboard
 */
const API_BASE = '/api/v1';

class APIClient {
    constructor() {
        // Don't cache token - get it fresh from localStorage on each request
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        console.log(`[API] Making request to: ${url}`);
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Get token fresh from localStorage on each request
        const token = localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log(`[API] Token present, length: ${token.length}`);
        } else {
            console.warn(`[API] No token found in localStorage for ${endpoint}`);
        }

        const config = {
            ...options,
            headers
        };

        try {
            console.log(`[API] Fetching ${url}...`);
            const response = await fetch(url, config);
            console.log(`[API] Response status: ${response.status} for ${endpoint}`);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.error(`[API] Non-JSON response for ${endpoint}:`, text.substring(0, 200));
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}`);
            }

            if (!response.ok) {
                const errorMsg = data.detail || data.message || `HTTP error! status: ${response.status}`;
                console.error(`[API] Error [${response.status}] for ${endpoint}:`, errorMsg);
                throw new Error(errorMsg);
            }

            console.log(`[API] Success for ${endpoint}`);
            return data;
        } catch (error) {
            console.error(`[API] Request failed for ${endpoint}:`, {
                url: url,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async requestWithAPIKey(endpoint, apiKey, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...options.headers
        };

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        // Store token in localStorage (don't cache in this.token)
        if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
        }
        return data;
    }

    async getCurrentUser() {
        console.log('Calling /auth/me endpoint...');
        try {
            const result = await this.request('/auth/me');
            console.log('getCurrentUser result:', result);
            return result;
        } catch (error) {
            console.error('getCurrentUser error:', error);
            throw error;
        }
    }

    // Dashboard endpoints
    async getOverview(days = 30) {
        console.log(`[API] Calling getOverview with days=${days}`);
        try {
            const result = await this.request(`/dashboard/overview?days=${days}`);
            console.log('[API] getOverview result:', result);
            return result;
        } catch (error) {
            console.error('[API] getOverview error:', error);
            throw error;
        }
    }

    async getAnomalies(filters = {}) {
        const params = new URLSearchParams();
        if (filters.department) params.append('department', filters.department);
        if (filters.priority) params.append('priority', filters.priority);
        if (filters.date_from) params.append('date_from', filters.date_from);
        if (filters.date_to) params.append('date_to', filters.date_to);
        if (filters.limit) params.append('limit', filters.limit);

        return this.request(`/dashboard/anomalies?${params.toString()}`);
    }

    async getPatientAnomalies(patientId) {
        return this.request(`/dashboard/patient/${patientId}`);
    }

    async listPatients() {
        return this.request(`/dashboard/patients?limit=50`);
    }

    async resolveAnomaly(anomalyId, action = 'resolve', notes = '') {
        return this.request(`/dashboard/anomaly/${anomalyId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({
                action,
                resolution_notes: notes
            })
        });
    }

    async ingestData(patientData, billingData = []) {
        return this.request('/dashboard/ingest-data', {
            method: 'POST',
            body: JSON.stringify({
                patient_data: patientData,
                billing_data: billingData
            })
        });
    }

    // API Key management
    async generateAPIKey(name, expiresDays = 365) {
        return this.request('/auth/generate_api_key', {
            method: 'POST',
            body: JSON.stringify({
                name,
                expires_days: expiresDays
            })
        });
    }

    async listAPIKeys() {
        return this.request('/auth/api_keys');
    }

    async revokeAPIKey(keyId) {
        return this.request(`/auth/api_key/${keyId}`, {
            method: 'DELETE'
        });
    }
}

// Export singleton instance
const api = new APIClient();

