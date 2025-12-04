// Low Stock Alerts Management
let allAlerts = [];
let filteredAlerts = [];
let currentFilter = 'all';

// Initialize Low Stock Alerts
function initLowStockAlerts() {
    loadLowStockAlerts();
    loadItemsForConfiguration();
    setupSearchListener();
    setupFormHandlers();
}

// Load all low stock alerts
function loadLowStockAlerts() {
    fetch('../backend/api/low_stock/get_alerts.php')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.alerts) {
                allAlerts = data.alerts;
                filteredAlerts = allAlerts;
                displayAlerts(filteredAlerts);
            } else {
                displayNoAlerts();
            }
        })
        .catch(error => {
            console.error('Error loading low stock alerts:', error);
            displayError('Failed to load alerts');
        });
}

// Display alerts in the table
function displayAlerts(alerts) {
    const tbody = document.getElementById('lowStockBody');

    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No low stock alerts found</td></tr>';
        return;
    }

    let html = '';
    alerts.forEach(alert => {
        const statusBadge = getStatusBadge(alert.status);
        const currentQty = Number(alert.current_quantity || alert.current_stock || 0);
        const threshold = Number(alert.threshold_value || alert.threshold || 0);
        const statusClass = getStatusClass(currentQty, threshold);
        const alertDate = formatDate(alert.alert_date);
        const itemId = alert.book_id || alert.item_id || alert.alert_id;

        html += `
            <tr>
                <td>
                    <strong>${escapeHtml(alert.item_name)}</strong>
                    ${alert.isbn ? '<br><small style="color: var(--text-secondary);">ISBN: ' + escapeHtml(alert.isbn) + '</small>' : ''}
                </td>
                <td class="${statusClass}">${escapeHtml(String(currentQty))}</td>
                <td>${escapeHtml(String(threshold || 'N/A'))}</td>
                <td>${statusBadge}</td>
                <td>${alertDate}</td>
                <td>
                    <button class="btn-icon" onclick="showStatusModal(${alert.alert_id}, '${escapeHtml(alert.item_name)}')" title="Update Status">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="viewAlertHistory(${alert.alert_id}, '${escapeHtml(alert.item_name)}')" title="View History">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="btn-icon" onclick="reorderItem(${alert.alert_id}, ${itemId})" title="Reorder" style="color: var(--success-color);">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusMap = {
        'pending': { text: 'Needs Attention', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
        'acknowledged': { text: 'Acknowledged', color: '#0066ff', bgColor: 'rgba(0, 102, 255, 0.1)' },
        'reorder_initiated': { text: 'Reorder Initiated', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
        'resolved': { text: 'Resolved', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.08)' }
    };

    const statusInfo = statusMap[status] || statusMap['pending'];

    return `<span style="display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; color: ${statusInfo.color}; background-color: ${statusInfo.bgColor};">${statusInfo.text}</span>`;
}

// Get status class for quantity display
function getStatusClass(currentQty, threshold) {
    currentQty = Number(currentQty || 0);
    threshold = Number(threshold || 0);
    if (currentQty === 0) return 'out-of-stock';
    if (threshold > 0 && currentQty < threshold * 0.5) return 'out-of-stock';
    if (threshold > 0 && currentQty < threshold) return 'low-stock';
    return '';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Display no alerts message
function displayNoAlerts() {
    const tbody = document.getElementById('lowStockBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No low stock alerts at this time</td></tr>';
}

// Display error message
function displayError(message) {
    const tbody = document.getElementById('lowStockBody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--danger-color);">${escapeHtml(message)}</td></tr>`;
}

// Filter alerts by status
function filterByStatus(status) {
    currentFilter = status;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.filter-btn[data-filter="${status}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Filter alerts
    if (status === 'all') {
        filteredAlerts = allAlerts;
    } else if (status === 'critical') {
        filteredAlerts = allAlerts.filter(alert => {
            if (typeof alert.is_critical !== 'undefined') {
                return Number(alert.is_critical) === 1;
            }
            const threshold = Number(alert.threshold || alert.threshold_value || 0);
            const qty = Number(alert.current_quantity || alert.current_stock || 0);
            return qty === 0 || (threshold > 0 && qty < threshold * 0.5);
        });
    } else if (status === 'acknowledged') {
        filteredAlerts = allAlerts.filter(alert => alert.status === 'acknowledged');
    } else if (status === 'reorder') {
        filteredAlerts = allAlerts.filter(alert => alert.status === 'reorder_initiated');
    } else {
        filteredAlerts = allAlerts.filter(alert => alert.status === status);
    }

    displayAlerts(filteredAlerts);

    // Clear search when changing filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
}

// Setup search listener
function setupSearchListener() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();

            const base = filteredAlerts && filteredAlerts.length ? filteredAlerts : allAlerts;

            const searchFiltered = base.filter(alert => {
                const itemName = (alert.item_name || alert.title || '').toString().toLowerCase();
                const isbn = (alert.isbn || '').toString().toLowerCase();
                return itemName.includes(searchTerm) || isbn.includes(searchTerm);
            });

            displayAlerts(searchFiltered);
        });
    }
}

// Load items for configuration dropdown
function loadItemsForConfiguration() {
    fetch('../backend/api/catalogue/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.items) {
                const select = document.getElementById('item_select');
                if (select) {
                    let options = '<option value="">-- Select an item --</option>';
                    data.items.forEach(item => {
                        const itemId = item.book_id || item.id;
                        const itemName = item.title || item.item_name;
                        options += `<option value="${itemId}">${escapeHtml(itemName)} ${item.isbn ? '(ISBN: ' + escapeHtml(item.isbn) + ')' : ''}</option>`;
                    });
                    select.innerHTML = options;
                }
            }
        })
        .catch(error => {
            console.error('Error loading items:', error);
        });
}

// Show configure threshold modal
function showConfigureModal() {
    document.getElementById('configureForm').reset();
    document.getElementById('configureModal').style.display = 'block';
}

// Show status update modal
function showStatusModal(alertId, itemName) {
    document.getElementById('alert_id').value = alertId;
    document.getElementById('alertItemDisplay').textContent = itemName;
    document.getElementById('statusForm').reset();
    document.getElementById('statusModal').style.display = 'block';
}

// View alert history
function viewAlertHistory(alertId, itemName) {
    document.getElementById('alertHistoryTitle').textContent = itemName + ' - Alert History';
    document.getElementById('alertHistoryModal').style.display = 'block';
    loadAlertHistory(alertId);
}

// Load alert history
function loadAlertHistory(alertId) {
    const tbody = document.getElementById('alertHistoryBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Loading history...</td></tr>';

    fetch(`../backend/api/low_stock/get_alerts.php?alert_id=${alertId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.history && data.history.length > 0) {
                let html = '';

                data.history.forEach(record => {
                    const date = formatDate(record.timestamp || record.updated_at);
                    const statusChange = record.status_change || record.status || 'N/A';
                    const updatedBy = record.updated_by || record.username || 'System';
                    const notes = record.notes || 'N/A';

                    html += `
                        <tr>
                            <td>${escapeHtml(date)}</td>
                            <td>${escapeHtml(statusChange)}</td>
                            <td>${escapeHtml(updatedBy)}</td>
                            <td>${escapeHtml(notes)}</td>
                        </tr>
                    `;
                });

                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No history available</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error loading alert history:', error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Error loading history</td></tr>';
        });
}

// Reorder item
function reorderItem(alertId, bookId) {
    if (!confirm('Mark this item for reorder?')) return;
    updateAlertStatus(alertId, 'reorder_initiated', 'Marked for reorder');
}

// Setup form handlers
function setupFormHandlers() {
    const configureForm = document.getElementById('configureForm');
    if (configureForm) {
        configureForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitConfigureThreshold();
        });
    }

    const statusForm = document.getElementById('statusForm');
    if (statusForm) {
        statusForm.addEventListener('submit', function(e) {
            e.preventDefault();
            submitStatusUpdate();
        });
    }
}

// Submit configure threshold
function submitConfigureThreshold() {
    const formData = new FormData(document.getElementById('configureForm'));
    const data = {
        book_id: formData.get('item_select'),
        threshold: formData.get('threshold_value'),
        is_critical: document.getElementById('is_critical').checked ? 1 : 0
    };

    if (!data.book_id || !data.threshold) {
        alert('Please select an item and enter a threshold value');
        return;
    }

    console.log('Submitting threshold configuration:', data);

    fetch('../backend/api/low_stock/check_thresholds.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        if (data.success) {
            alert('Threshold configured successfully');
            document.getElementById('configureModal').style.display = 'none';
            loadLowStockAlerts();
        } else {
            alert('Error: ' + (data.message || data.error || 'Failed to configure threshold'));
        }
    })
    .catch(error => {
        console.error('Full error details:', error);
        alert('An error occurred while configuring threshold: ' + error.message);
    });
}

// Submit status update
function submitStatusUpdate() {
    const alertId = document.getElementById('alert_id').value;
    const status = document.getElementById('alert_status').value;
    const notes = document.getElementById('status_notes').value;

    if (!status) {
        alert('Please select a status');
        return;
    }

    updateAlertStatus(alertId, status, notes);
}

// Update alert status
function updateAlertStatus(alertId, status, notes) {
    const data = {
        alert_id: alertId,
        status: status,
        notes: notes || ''
    };

    fetch('../backend/api/low_stock/update_alert_status.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Alert status updated successfully');
            document.getElementById('statusModal').style.display = 'none';
            loadLowStockAlerts();
        } else {
            alert('Error: ' + (data.message || 'Failed to update status'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while updating status');
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (text === null || typeof text === 'undefined') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
