let allAlerts = [];
let currentFilter = 'all';

//Initializes Low Stock Alerts
function initLowStockAlerts() {
    loadLowStockAlerts();
    loadItemsForConfiguration();
    setupSearchListener();
    setupFormHandlers();
}

//Loads all low stock alerts
function loadLowStockAlerts() {
    console.log('Loading low stock alerts...');

    fetch('../backend/api/low_stock/get_alerts.php')
        .then(response => {
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            return response.json();
        })
        .then(data => {
            console.log('Full API Response:', data);
            console.log('Success:', data.success);
            console.log('Alerts:', data.alerts);
            console.log('Count:', data.count);
            console.log('Debug Info:', data.debug);

            if (data.success) {
                if (data.alerts && Array.isArray(data.alerts) && data.alerts.length > 0) {
                    console.log('✓ Displaying', data.alerts.length, 'alerts');
                    allAlerts = data.alerts;
                    displayAlerts(allAlerts);
                } else {
                    console.log('✗ No alerts found in response');
                    console.log('Alerts value:', data.alerts);
                    console.log('Is array?', Array.isArray(data.alerts));
                    displayNoAlerts();
                }
            } else {
                console.error('API returned success=false:', data.error);
                displayError(data.error || 'Failed to load alerts');
            }
        })
        .catch(error => {
            console.error('Error loading low stock alerts:', error);
            displayError('Failed to load alerts: ' + error.message);
        });
}

//Displays alerts in the table
function displayAlerts(alerts) {
    const tbody = document.getElementById('lowStockBody');

    //Applys filter
    let filtered = alerts;
    if (currentFilter === 'critical') {
        filtered = alerts.filter(a => Number(a.is_critical) === 1 || Number(a.current_quantity) === 0);
    } else if (currentFilter === 'acknowledged') {
        filtered = alerts.filter(a => a.status === 'acknowledged');
    } else if (currentFilter === 'reorder') {
        filtered = alerts.filter(a => a.status === 'reorder_initiated');
    }

    console.log('Filtered alerts:', filtered.length);

    if (!filtered || filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No low stock alerts found for current filter</td></tr>';
        return;
    }

    let html = '';
    filtered.forEach(alert => {
        const statusBadge = getStatusBadge(alert.status);
        const currentQty = Number(alert.current_quantity || 0);
        const threshold = Number(alert.threshold_value || alert.threshold || 0);
        const statusClass = currentQty === 0 ? 'out-of-stock' : (currentQty < threshold * 0.5 ? 'low-stock' : '');
        const alertDate = formatDate(alert.alert_date);

        html += `
            <tr>
                <td>
                    <strong>${escapeHtml(alert.item_name)}</strong>
                    ${alert.isbn ? '<br><small style="color: #8b92ad;">ISBN: ' + escapeHtml(alert.isbn) + '</small>' : ''}
                    ${alert.author ? '<br><small style="color: #8b92ad;">Author: ' + escapeHtml(alert.author) + '</small>' : ''}
                </td>
                <td class="${statusClass}"><strong>${currentQty}</strong></td>
                <td>${threshold || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${alertDate}</td>
                <td>
                    <button class="btn-icon" onclick="showStatusModal(${alert.alert_id}, '${escapeHtml(alert.item_name).replace(/'/g, "\\\'")}')" title="Update Status">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="viewAlertHistory(${alert.alert_id}, '${escapeHtml(alert.item_name).replace(/'/g, "\\\'")}')" title="View History">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn-icon" onclick="reorderItem(${alert.alert_id})" title="Reorder" style="color: #10b981;">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    console.log('Table updated with', filtered.length, 'rows');
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        'pending': '<span style="background: rgba(245,158,11,0.1); color: #f59e0b; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Needs Attention</span>',
        'acknowledged': '<span style="background: rgba(0,102,255,0.1); color: #0066ff; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Acknowledged</span>',
        'reorder_initiated': '<span style="background: rgba(16,185,129,0.1); color: #10b981; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Reorder Initiated</span>',
        'resolved': '<span style="background: rgba(107,114,128,0.08); color: #6b7280; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Resolved</span>'
    };
    return badges[status] || badges['pending'];
}

//Formats the date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

//Displays no alerts message
function displayNoAlerts() {
    document.getElementById('lowStockBody').innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #10b981;"><i class="fas fa-check-circle"></i> No low stock alerts at this time - all items are well stocked!</td></tr>';
}

//Display error message
function displayError(message) {
    document.getElementById('lowStockBody').innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(message)}</td></tr>`;
}

//Filters alerts by status
function filterByStatus(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-filter="${status}"]`).classList.add('active');
    displayAlerts(allAlerts);
}

//Setup search listener
function setupSearchListener() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            const filtered = allAlerts.filter(a =>
                (a.item_name || '').toLowerCase().includes(term) ||
                (a.isbn || '').toLowerCase().includes(term) ||
                (a.author || '').toLowerCase().includes(term)
            );
            displayAlerts(filtered);
        });
    }
}

//Loads items for configuration dropdown
function loadItemsForConfiguration() {
    fetch('../backend/api/catalogue/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.items) {
                const select = document.getElementById('item_select');
                if (select) {
                    let options = '<option value="">-- Select an item --</option>';
                    data.items.forEach(item => {
                        const id = item.book_id || item.id;
                        const name = item.title || item.item_name;
                        options += `<option value="${id}">${escapeHtml(name)}</option>`;
                    });
                    select.innerHTML = options;
                }
            }
        })
        .catch(error => console.error('Error loading items:', error));
}

// Show modals
function showConfigureModal() {
    document.getElementById('configureForm').reset();
    document.getElementById('configureModal').style.display = 'block';
}

function showStatusModal(alertId, itemName) {
    document.getElementById('alert_id').value = alertId;
    document.getElementById('alertItemDisplay').textContent = itemName;
    document.getElementById('statusForm').reset();
    document.getElementById('statusModal').style.display = 'block';
}

function viewAlertHistory(alertId, itemName) {
    document.getElementById('alertHistoryTitle').textContent = itemName + ' - Alert History';
    document.getElementById('alertHistoryModal').style.display = 'block';

    fetch(`../backend/api/low_stock/get_alerts.php?alert_id=${alertId}`)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('alertHistoryBody');
            if (data.success && data.history && data.history.length > 0) {
                let html = '';
                data.history.forEach(record => {
                    html += `
                        <tr>
                            <td>${formatDate(record.timestamp || record.updated_at)}</td>
                            <td>${escapeHtml(record.status_change || record.status || 'N/A')}</td>
                            <td>${escapeHtml(record.updated_by || 'System')}</td>
                            <td>${escapeHtml(record.notes || 'N/A')}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No history available</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('alertHistoryBody').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Error loading history</td></tr>';
        });
}

function reorderItem(alertId) {
    if (confirm('Mark this item for reorder?')) {
        updateAlertStatus(alertId, 'reorder_initiated', 'Marked for reorder');
    }
}

//Setup form handlers
function setupFormHandlers() {
    document.getElementById('configureForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const data = {
            book_id: document.getElementById('item_select').value,
            threshold: document.getElementById('threshold_value').value,
            is_critical: document.getElementById('is_critical').checked ? 1 : 0
        };

        if (!data.book_id || !data.threshold) {
            alert('Please select an item and enter a threshold value');
            return;
        }

        fetch('../backend/api/low_stock/check_thresholds.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Threshold configured successfully');
                document.getElementById('configureModal').style.display = 'none';
                loadLowStockAlerts();
            } else {
                alert('Error: ' + (data.message || data.error || 'Failed'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred');
        });
    });

    document.getElementById('statusForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const alertId = document.getElementById('alert_id').value;
        const status = document.getElementById('alert_status').value;
        const notes = document.getElementById('status_notes').value;

        if (!status) {
            alert('Please select a status');
            return;
        }
        updateAlertStatus(alertId, status, notes);
    });
}

//Update alert status
function updateAlertStatus(alertId, status, notes) {
    fetch('../backend/api/low_stock/update_alert_status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, status: status, notes: notes || '' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Alert status updated successfully');
            document.getElementById('statusModal').style.display = 'none';
            loadLowStockAlerts();
        } else {
            alert('Error: ' + (data.message || 'Failed'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred');
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
