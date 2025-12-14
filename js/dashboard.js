/**
 * Dashboard JavaScript
 */

// Check authentication
window.addEventListener('DOMContentLoaded', async () => {
    console.log('[Dashboard] DOMContentLoaded event fired');
    
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('[Dashboard] No token found, redirecting to login');
        window.location.href = '/login.html';
        return;
    }

    // Ensure api object is available
    if (typeof api === 'undefined') {
        console.error('[Dashboard] API client not loaded!');
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = 'Error: API not loaded';
        return;
    }

    // Get UI elements
    const userNameEl = document.getElementById('user-name');
    const planBadgeEl = document.getElementById('plan-badge');
    
    // Set initial loading state
    if (userNameEl) userNameEl.textContent = 'Loading...';
    if (planBadgeEl) planBadgeEl.textContent = 'LOADING';

    // Set a timeout to clear loading state if user info takes too long
    setTimeout(() => {
        if (userNameEl && userNameEl.textContent === 'Loading...') {
            console.log('[Dashboard] User info timeout, setting fallback');
            userNameEl.textContent = 'User';
        }
        if (planBadgeEl && planBadgeEl.textContent === 'LOADING') {
            planBadgeEl.textContent = 'STARTER';
        }
    }, 3000); // 3 second timeout

    // Load user info in background (non-blocking)
    loadUserInfo();

    // Load dashboard data IMMEDIATELY (don't wait for user info)
    console.log('[Dashboard] Loading dashboard data immediately...');
    try {
        await loadOverview();
        console.log('[Dashboard] Overview loaded successfully');
    } catch (error) {
        console.error('[Dashboard] Failed to load overview:', error);
        const totalLeakageEl = document.getElementById('total-leakage');
        const totalAnomaliesEl = document.getElementById('total-anomalies');
        if (totalLeakageEl) totalLeakageEl.textContent = 'Error';
        if (totalAnomaliesEl) totalAnomaliesEl.textContent = 'Error';
    }
    
    try {
        await loadAPIKeys();
        console.log('[Dashboard] API keys loaded successfully');
    } catch (error) {
        console.error('[Dashboard] Failed to load API keys:', error);
    }
});

// Separate function to load user info
async function loadUserInfo() {
    const userNameEl = document.getElementById('user-name');
    const planBadgeEl = document.getElementById('plan-badge');
    
    try {
        console.log('[Dashboard] Loading user info...');
        console.log('[Dashboard] Token present:', !!localStorage.getItem('access_token'));
        
        if (typeof api === 'undefined') {
            throw new Error('API client not available');
        }
        
        console.log('[Dashboard] Calling api.getCurrentUser()...');
        const user = await api.getCurrentUser();
        console.log('[Dashboard] User data received:', user);
        
        if (!user) {
            throw new Error('User data not available');
        }
        
        if (userNameEl) {
            const displayName = user.full_name || user.email || 'User';
            userNameEl.textContent = displayName;
            console.log('[Dashboard] User name set to:', displayName);
        }
        
        // Get hospital plan
        let plan = 'STARTER';
        if (user.hospital) {
            if (user.hospital.plan) {
                if (typeof user.hospital.plan === 'string') {
                    plan = user.hospital.plan;
                } else if (user.hospital.plan.value) {
                    plan = user.hospital.plan.value;
                } else {
                    plan = String(user.hospital.plan);
                }
            }
        }
        
        if (planBadgeEl) {
            planBadgeEl.textContent = plan.toUpperCase();
            console.log('[Dashboard] Plan badge set to:', plan.toUpperCase());
        }
        
        console.log('[Dashboard] User info loaded successfully');
    } catch (error) {
        console.error('[Dashboard] Failed to load user info:', error);
        
        // Check if it's a 401 or authentication error
        const isAuthError = error.message && (
            error.message.includes('401') || 
            error.message.includes('Unauthorized') ||
            error.message.includes('credentials') ||
            error.message.includes('Authentication') ||
            error.message.includes('Could not validate')
        );
        
        if (isAuthError) {
            console.log('[Dashboard] Authentication error, redirecting to login');
            localStorage.removeItem('access_token');
            window.location.href = '/login.html';
            return;
        }
        
        // For other errors, show fallback
        if (userNameEl) {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    userNameEl.textContent = `User ID: ${payload.sub || 'Unknown'}`;
                } catch {
                    userNameEl.textContent = 'User';
                }
            } else {
                userNameEl.textContent = 'Not logged in';
            }
        }
        if (planBadgeEl) {
            planBadgeEl.textContent = 'STARTER';
        }
    }
}

// Tab switching
function showTab(tabName, event) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Activate tab button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: find tab button by text
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName.toLowerCase())) {
                tab.classList.add('active');
            }
        });
    }

    // Load tab-specific data
    if (tabName === 'anomalies') {
        loadAnomalies();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

// Load overview
async function loadOverview() {
    try {
        console.log('[Dashboard] loadOverview() called');
        console.log('[Dashboard] API client available:', typeof api !== 'undefined');
        
        if (typeof api === 'undefined') {
            throw new Error('API client not available');
        }
        
        console.log('[Dashboard] Calling api.getOverview(30)...');
        const overview = await api.getOverview(30);
        console.log('[Dashboard] Overview data received:', overview);
        
        if (!overview) {
            throw new Error('No overview data received');
        }

        // Update summary cards
        document.getElementById('total-leakage').textContent = `$${Math.round(overview.total_leakage).toLocaleString()}`;
        document.getElementById('total-anomalies').textContent = overview.total_anomalies;
        document.getElementById('high-priority').textContent = overview.high_priority_count;
        document.getElementById('medium-priority').textContent = overview.medium_priority_count;

        // Update department breakdown
        const deptContainer = document.getElementById('department-breakdown');
        if (deptContainer) {
            deptContainer.innerHTML = '';
            const deptBreakdown = overview.department_breakdown || {};
            
            if (Object.keys(deptBreakdown).length === 0) {
                deptContainer.innerHTML = '<div class="empty-state">No department data available</div>';
            } else {
                for (const [dept, data] of Object.entries(deptBreakdown)) {
                    const deptItem = document.createElement('div');
                    deptItem.className = 'department-item';
                    const count = data.count || 0;
                    const leakage = parseFloat(data.leakage || 0);
                    deptItem.innerHTML = `
                        <h4>${dept}</h4>
                        <p>${count} anomalies</p>
                        <p><strong>$${leakage.toFixed(2)}</strong> leakage</p>
                    `;
                    deptContainer.appendChild(deptItem);
                }
            }
        }

        // Update recent anomalies table
        const tableBody = document.querySelector('#recent-anomalies-table tbody');
        if (tableBody) {
            tableBody.innerHTML = '';
            const recentAnomalies = overview.recent_anomalies || [];
            
            if (recentAnomalies.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No recent anomalies</td></tr>';
            } else {
                recentAnomalies.forEach(anomaly => {
                    const row = document.createElement('tr');
                    const priority = (anomaly.priority || 'medium').toLowerCase();
                    const leakage = parseFloat(anomaly.leakage || 0);
                    const detectedDate = anomaly.detected_at ? new Date(anomaly.detected_at).toLocaleDateString() : 'N/A';
                    
                    row.innerHTML = `
                        <td>${anomaly.type || 'N/A'}</td>
                        <td><span class="priority-badge ${priority}">${priority}</span></td>
                        <td>${anomaly.department || 'N/A'}</td>
                        <td>$${leakage.toFixed(2)}</td>
                        <td>${detectedDate}</td>
                        <td><button class="btn-primary" onclick="resolveAnomaly(${anomaly.id})">Resolve</button></td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('[Dashboard] Failed to load overview:', error);
        console.error('[Dashboard] Error stack:', error.stack);
        
        // Show error message in dashboard
        const errorMsg = error.message || 'Failed to load dashboard data';
        const dashboardGrid = document.querySelector('.dashboard-grid');
        if (dashboardGrid) {
            dashboardGrid.innerHTML = `
                <div class="card full-width">
                    <div class="error-message">Error: ${errorMsg}</div>
                    <p>Please check the browser console (F12) for details.</p>
                    <p><button class="btn-primary" onclick="location.reload()">Refresh Page</button></p>
                </div>
            `;
        }
        
        // Also update individual elements
        const totalLeakageEl = document.getElementById('total-leakage');
        const totalAnomaliesEl = document.getElementById('total-anomalies');
        if (totalLeakageEl) totalLeakageEl.textContent = 'Error';
        if (totalAnomaliesEl) totalAnomaliesEl.textContent = 'Error';
    }
}

// Load anomalies
async function loadAnomalies() {
    try {
        const department = document.getElementById('filter-department').value;
        const priority = document.getElementById('filter-priority').value;
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;

        const filters = {};
        if (department) filters.department = department;
        if (priority) filters.priority = priority;
        if (dateFrom) filters.date_from = dateFrom;
        if (dateTo) filters.date_to = dateTo;

        const anomalies = await api.getAnomalies(filters);

        const tableBody = document.querySelector('#anomalies-table tbody');
        if (!tableBody) {
            console.error('Anomalies table body not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (!anomalies || anomalies.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No anomalies found</td></tr>';
            return;
        }
        
        anomalies.forEach(anomaly => {
            const row = document.createElement('tr');
            const anomalyType = anomaly.anomaly_type?.value || anomaly.anomaly_type || 'unknown';
            const priority = (anomaly.priority?.value || anomaly.priority || 'medium').toLowerCase();
            const leakage = parseFloat(anomaly.leakage_amount || 0);
            const detectedDate = anomaly.detected_at ? new Date(anomaly.detected_at).toLocaleDateString() : 'N/A';
            
            row.innerHTML = `
                <td>${anomaly.id || 'N/A'}</td>
                <td>${anomalyType}</td>
                <td><span class="priority-badge ${priority}">${priority}</span></td>
                <td>${anomaly.department || 'N/A'}</td>
                <td>$${leakage.toFixed(2)}</td>
                <td>${anomaly.description || 'N/A'}</td>
                <td>${detectedDate}</td>
                <td>
                    <button class="btn-primary" onclick="resolveAnomaly(${anomaly.id})">Resolve</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load anomalies:', error);
        alert('Failed to load anomalies: ' + error.message);
    }
}

// Search patient
async function searchPatient(event) {
    // Only skip if it's a keyup event and not Enter key
    if (event && event.type === 'keyup' && event.key !== 'Enter') {
        return;
    }

    const patientId = document.getElementById('patient-search').value.trim();
    const container = document.getElementById('patient-details');
    
    if (!patientId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>Please enter a Patient ID to search</p>
                <p><small>Example: P001, P002, etc.</small></p>
            </div>
        `;
        return;
    }

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
            <div class="loading-spinner"></div>
            <p>Loading patient data for "${patientId}"...</p>
        </div>
    `;

    try {
        const data = await api.getPatientAnomalies(patientId);
        if (!data) {
            container.innerHTML = '<div class="error-message">No data returned from server</div>';
            return;
        }
        
        const patientName = data.patient_name || data.patient_id || 'Unknown';
        const visitId = data.visit_id || 'N/A';
        const totalLeakage = parseFloat(data.total_leakage || 0);
        const anomalies = data.anomalies || [];
        
        container.innerHTML = `
            <h2>Patient: ${patientName}</h2>
            <p><strong>Patient ID:</strong> ${data.patient_id || 'N/A'}</p>
            <p><strong>Visit ID:</strong> ${visitId}</p>
            <p><strong>Total Leakage:</strong> $${totalLeakage.toFixed(2)}</p>
            <h3>Anomalies (${anomalies.length})</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Priority</th>
                            <th>Department</th>
                            <th>Leakage</th>
                            <th>Description</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.anomalies && data.anomalies.length > 0 ? data.anomalies.map(a => {
                            const anomalyType = a.anomaly_type?.value || a.anomaly_type || 'unknown';
                            const priority = (a.priority?.value || a.priority || 'medium').toLowerCase();
                            const leakage = parseFloat(a.leakage_amount || 0);
                            return `
                            <tr>
                                <td>${anomalyType}</td>
                                <td><span class="priority-badge ${priority}">${priority}</span></td>
                                <td>${a.department || 'N/A'}</td>
                                <td>$${leakage.toFixed(2)}</td>
                                <td>${a.description || 'N/A'}</td>
                                <td><button class="btn-primary" onclick="resolveAnomaly(${a.id})">Resolve</button></td>
                            </tr>
                        `;
                        }).join('') : '<tr><td colspan="6" style="text-align: center;">No anomalies found for this patient</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Patient search error:', error);
        // container is already declared above
        let errorMsg = 'Failed to load patient data';
        if (error.message) {
            if (error.message.includes('404') || error.message.includes('not found')) {
                errorMsg = `Patient "${patientId}" not found. Please check the Patient ID and try again.`;
            } else {
                errorMsg = error.message;
            }
        }
        container.innerHTML = `
            <div class="error-message">
                <h3>Error</h3>
                <p>${errorMsg}</p>
                <p><small>Tip: Try searching with a Patient ID from your data (e.g., P001, P002, etc.)</small></p>
            </div>
        `;
    }
}

// Load patient list
async function loadPatientList() {
    try {
        const patients = await api.listPatients();
        const listContainer = document.getElementById('patient-list');
        const detailsContainer = document.getElementById('patient-details');
        
        if (!patients || patients.length === 0) {
            listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No patients with anomalies found</div>';
            listContainer.style.display = 'block';
            detailsContainer.innerHTML = '';
            return;
        }
        
        // Show patient list
        listContainer.innerHTML = `
            <div class="card">
                <h3>Patients with Anomalies (${patients.length})</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Patient ID</th>
                                <th>Name</th>
                                <th>Anomalies</th>
                                <th>Total Leakage</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${patients.map(p => `
                                <tr>
                                    <td><strong>${p.patient_id}</strong></td>
                                    <td>${p.patient_name || 'N/A'}</td>
                                    <td>${p.anomaly_count}</td>
                                    <td>$${parseFloat(p.total_leakage || 0).toFixed(2)}</td>
                                    <td><button class="btn-primary" onclick="searchPatientById('${p.patient_id}')">View Details</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        listContainer.style.display = 'block';
        detailsContainer.innerHTML = '';
    } catch (error) {
        console.error('Failed to load patient list:', error);
        alert('Failed to load patient list: ' + error.message);
    }
}

// Search patient by ID (from list)
function searchPatientById(patientId) {
    document.getElementById('patient-search').value = patientId;
    searchPatient(null);
    // Hide patient list after selecting
    document.getElementById('patient-list').style.display = 'none';
}

// Resolve anomaly
async function resolveAnomaly(anomalyId) {
    if (!confirm('Mark this anomaly as resolved?')) return;

    try {
        await api.resolveAnomaly(anomalyId, 'resolve');
        alert('Anomaly resolved successfully');
        loadOverview();
        loadAnomalies();
    } catch (error) {
        alert('Failed to resolve anomaly: ' + error.message);
    }
}

// Generate API Key
async function generateAPIKey(event) {
    event.preventDefault();
    const name = document.getElementById('api-key-name').value;
    const expires = parseInt(document.getElementById('api-key-expires').value) || 365;

    try {
        const result = await api.generateAPIKey(name, expires);
        document.getElementById('generated-api-key').textContent = result.api_key;
        document.getElementById('api-key-result').style.display = 'block';
        document.getElementById('api-key-form').reset();
        loadAPIKeys();
    } catch (error) {
        alert('Failed to generate API key: ' + error.message);
    }
}

// Copy API Key
function copyAPIKey() {
    const key = document.getElementById('generated-api-key').textContent;
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard!');
}

// Load API Keys
async function loadAPIKeys() {
    try {
        const keys = await api.listAPIKeys();
        if (!keys) {
            keys = []; // Default to empty array
        }
        
        const tableBody = document.querySelector('#api-keys-table tbody');
        if (!tableBody) {
            return; // Table might not exist if we're not on that tab
        }
        
        tableBody.innerHTML = '';
        
        if (keys.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No API keys found. Generate one to get started.</td></tr>';
            return;
        }
        
        keys.forEach(key => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${key.name || 'Unnamed'}</td>
                <td>${key.created_at ? new Date(key.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>${key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}</td>
                <td>${key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}</td>
                <td>${key.is_active ? 'Active' : 'Inactive'}</td>
                <td><button class="btn-danger" onclick="revokeAPIKey(${key.id})">Revoke</button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load API keys:', error);
        const tableBody = document.querySelector('#api-keys-table tbody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="error-message">Error loading API keys: ${error.message}</td></tr>`;
        }
    }
}

// Revoke API Key
async function revokeAPIKey(keyId) {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
        await api.revokeAPIKey(keyId);
        alert('API key revoked successfully');
        loadAPIKeys();
    } catch (error) {
        alert('Failed to revoke API key: ' + error.message);
    }
}

// Load Settings
async function loadSettings() {
    try {
        const user = await api.getCurrentUser();
        if (!user) {
            throw new Error('User not found');
        }
        
        document.getElementById('account-info').innerHTML = `
            <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
            <p><strong>Name:</strong> ${user.full_name || 'N/A'}</p>
            <p><strong>Role:</strong> ${user.role || 'N/A'}</p>
        `;
        
        let plan = 'STARTER';
        if (user.hospital && user.hospital.plan) {
            plan = user.hospital.plan;
        }
        
        document.getElementById('plan-info').innerHTML = `
            <p><strong>Current Plan:</strong> ${plan.toUpperCase()}</p>
            <p><strong>Features:</strong></p>
            <ul>
                <li>${plan === 'starter' ? 'Admission + OPD' : ''}
                    ${plan === 'standard' ? 'Admission + OPD + Lab' : ''}
                    ${plan === 'premium' ? 'Admission + OPD + Lab + Pharmacy' : ''}
                    ${plan === 'enterprise' ? 'All modules + Multi-hospital' : ''}
                </li>
            </ul>
        `;
    } catch (error) {
        console.error('Failed to load settings:', error);
        document.getElementById('account-info').innerHTML = `
            <div class="error-message">Error loading account information: ${error.message}</div>
        `;
    }
}

// Upgrade Plan
function upgradePlan() {
    const plans = {
        'STARTER': { name: 'Standard', price: '$3,000/month', features: 'Adds Lab module' },
        'STANDARD': { name: 'Premium', price: '$7,500/month', features: 'Adds Pharmacy + Notifications' },
        'PREMIUM': { name: 'Enterprise', price: '$20,000+/month', features: 'Multi-hospital + Custom reports' },
        'ENTERPRISE': { name: 'Enterprise', price: 'Custom', features: 'Already on highest plan' }
    };
    
    const currentPlan = document.getElementById('plan-badge')?.textContent || 'STARTER';
    const nextPlan = plans[currentPlan];
    
    if (nextPlan && currentPlan !== 'ENTERPRISE') {
        const message = `Upgrade to ${nextPlan.name} Plan\n\n` +
                       `Price: ${nextPlan.price}\n` +
                       `Features: ${nextPlan.features}\n\n` +
                       `To upgrade, please contact:\n` +
                       `Email: sales@revenueintegrity.com\n` +
                       `Phone: +1 (555) 123-4567`;
        alert(message);
    } else {
        alert('You are already on the highest plan available.');
    }
}

// Logout
function logout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login.html';
}

