// Low Stock Alerts JS

document.addEventListener('DOMContentLoaded', function() {
    loadLowStockAlerts();
    document.getElementById('gradeFilter').addEventListener('change', loadLowStockAlerts);
    document.getElementById('dateFilter').addEventListener('change', loadLowStockAlerts);
});

function loadLowStockAlerts() {
    const grade = document.getElementById('gradeFilter').value;
    const date = document.getElementById('dateFilter').value;
    fetch(`../backend/api/catalogue/low_stock_alerts.php?action=list&grade_level=${encodeURIComponent(grade)}&date_range=${encodeURIComponent(date)}`)
        .then(async response => {
            const text = await response.text();
            try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; }
        })
        .then(data => {
            if (data.success) {
                displayLowStockAlerts(data.alerts);
            } else {
                displayLowStockAlerts([]);
            }
        })
        .catch(() => displayLowStockAlerts([]));
}

function displayLowStockAlerts(alerts) {
    const tbody = document.getElementById('alertsBody');
    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#f59e0b;">No low stock alerts</td></tr>';
        return;
    }
    let html = '';
    alerts.forEach(alert => {
        html += `<tr>
            <td>${alert.item_name || 'N/A'}</td>
            <td>${alert.current_quantity}</td>
            <td>${alert.threshold}</td>
            <td>${alert.status}</td>
            <td>${alert.alert_created_at ? alert.alert_created_at.split(' ')[0] : ''}</td>
            <td><button onclick="acknowledgeAlert(${alert.id})">Acknowledge</button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function acknowledgeAlert(alertId) {
    fetch('../backend/api/catalogue/low_stock_alerts.php?action=acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId })
    })
    .then(async response => { const text = await response.text(); try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; } })
    .then(() => loadLowStockAlerts());
}
