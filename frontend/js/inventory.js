// Inventory Management Module
let currentPage = 1;
const itemsPerPage = 50;
let allItems = [];
let selectedItems = new Set();
let filteredItems = [];
let currentDetailItem = null;

// Initialize inventory page
document.addEventListener('DOMContentLoaded', function() {
    loadInventory();
    setupEventListeners();
    setupRealTimeUpdates();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('inventorySearch').addEventListener('input', (e) => {
        filterInventory();
    });

    document.getElementById('gradeFilter').addEventListener('change', applyFilters);

    // Add to Quick Access button
    const quickAccessBtn = document.getElementById('addToQuickAccessBtn');
    if (quickAccessBtn) {
        quickAccessBtn.addEventListener('click', bulkAddFavourites);
    }

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const detailModal = document.getElementById('itemDetailModal');
        const bookModal = document.getElementById('bookModal');
        if (event.target === detailModal) {
            detailModal.style.display = 'none';
        }
        if (event.target === bookModal) {
            bookModal.style.display = 'none';
        }
    });

    // Event delegation for item title click -> show detail
    document.addEventListener('click', function(event) {
        const titleCell = event.target.closest('.item-title');
        if (titleCell) {
            const source = titleCell.dataset.source;
            const itemId = titleCell.dataset.itemId;
            const titleText = titleCell.dataset.title;
            showItemDetail(source, itemId, titleText);
        }
    });
}

// Real-time fuzzy search
// Local filter search for inventory
function filterInventory() {
    const searchInput = document.getElementById('inventorySearch');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tableRows = document.querySelectorAll('#inventoryBody tr');
    let visibleCount = 0;
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;
        // Search in Title, Grade, Stock columns
        for (let i = 0; i < Math.min(4, cells.length); i++) {
            const cellText = cells[i].textContent.toLowerCase();
            if (cellText.includes(searchTerm)) {
                match = true;
                break;
            }
        }
        if (searchTerm === '' || match) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    // Show message if no results found
    if (visibleCount === 0 && searchTerm !== '') {
        const tbody = document.getElementById('inventoryBody');
        const existingMessage = tbody.querySelector('.no-results');
        if (!existingMessage) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results';
            noResultsRow.innerHTML = `<td colspan="7" style="text-align: center; padding: 20px; color: #8b92ad;">No items found matching "${escapeHtml(searchTerm)}"</td>`;
            tbody.appendChild(noResultsRow);
        }
    } else {
        // Remove no results message if search is cleared
        const noResultsRow = document.querySelector('.no-results');
        if (noResultsRow) {
            noResultsRow.remove();
        }
    }
}

// Load inventory from API
async function loadInventory() {
    try {
        const response = await fetch('../backend/api/catalogue/list.php');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to load inventory');
        }
        
        allItems = data.items || [];
        console.log('Loaded items:', allItems.length, allItems.slice(0, 1));
        filteredItems = [...allItems];
        displayInventory(filteredItems);
        updateSelectionCount();
        applyFilters(); // Apply grade filter after loading
    } catch (error) {
        console.error('Error loading inventory:', error);
        const tbody = document.getElementById('inventoryBody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger-color);">Error: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// Apply filters (grade only)
function applyFilters() {
    const gradeFilter = document.getElementById('gradeFilter').value;
    const searchQuery = document.getElementById('inventorySearch').value;
    
    // If search is active, don't override with filter
    if (searchQuery.length > 0) {
        filterInventory();
        return;
    }
    
    filteredItems = allItems.filter(item => {
        const matchesGrade = !gradeFilter || 
            (item.grade_level || '').toLowerCase().includes(gradeFilter.toLowerCase());
        
        return matchesGrade;
    });
    
    currentPage = 1;
    displayInventory(filteredItems);
}

// Display inventory table
function displayInventory(items) {
    const tbody = document.getElementById('inventoryBody');
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        // Handle both 'title' and 'item_name' fields
        const itemTitle = item.item_name || item.title;
        const itemId = item.book_id || item.item_id;
        const source = item.source || 'manual';
        const gradeLevel = item.grade_level || 'N/A';
        const stock = item.quantity_on_hand || 0;
        // Always use rate field for price, parse from string if needed
        let price = 0;
        if (item.rate) {
            if (typeof item.rate === 'string') {
                const match = item.rate.match(/([\d,.]+)/);
                price = match ? parseFloat(match[1].replace(/,/g, '')) : 0;
            } else {
                price = parseFloat(item.rate);
            }
        }
        
        const stockClass = stock === 0 ? 'out-of-stock' : 
                          (stock < 10) ? 'low-stock' : '';
        const stockStatus = stock === 0 ? ' (Out of Stock)' : '';
        const isFavourite = item.is_favourite ? 'active' : '';
        const favouriteIcon = item.is_favourite ? '<i class="fas fa-star"></i>' : '<i class="fas fa-star" style="color: #ccc;"></i>';
        
        return `
            <tr class="${stockClass}">
                <td style="width: 40px;">
                    <input type="checkbox" class="item-checkbox" data-item-id="${itemId}" 
                           ${selectedItems.has(String(itemId)) ? 'checked' : ''} onchange="updateSelection()">
                </td>
                <td class="item-title" data-source="${source}" data-item-id="${itemId}" data-title="${escapeHtml(itemTitle)}">
                    ${escapeHtml(itemTitle)}
                </td>
                <td>${escapeHtml(gradeLevel)}</td>
                <td class="stock-cell">
                    <span class="stock-quantity ${stock === 0 ? 'out-of-stock' : ''}">${stock}</span>
                    ${stockStatus}
                </td>
                <td>JMD ${price.toFixed(2)}</td>
                <td style="width: 100px; text-align: center; color: #f59e0b;">${favouriteIcon}</td>
            </tr>
        `;
    }).join('');

    // Repair select-all checkbox state and ensure selection count is accurate
    const visibleCheckboxes = tbody.querySelectorAll('.item-checkbox');
    const allChecked = visibleCheckboxes.length > 0 && Array.from(visibleCheckboxes).every(cb => cb.checked);
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = allChecked;

    // Update the selection count after rendering
    updateSelectionCount();
}

// Toggle select all checkbox
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox').checked;
    const checkboxes = document.querySelectorAll('.item-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
    });
    
    updateSelection();
}

// Update selection count
function updateSelection() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    selectedItems.clear();
    
    checkboxes.forEach(checkbox => {
        selectedItems.add(checkbox.dataset.itemId);
    });
    
    updateSelectionCount();
}

// Update selection count display
function updateSelectionCount() {
    const count = selectedItems.size;
    document.getElementById('selectionCount').textContent = 
        `${count} item(s) selected`;
}

// Show item detail modal
async function showItemDetail(source, itemId, title) {
    try {
        const params = source === 'csv' ? `item_id=${itemId}` : `book_id=${itemId}`;
        const response = await fetch(`../backend/api/catalogue/list.php?${params}`);
        
        if (!response.ok) throw new Error('Failed to load item details');
        
        const data = await response.json();
        const item = data.items ? data.items[0] : data;
        
        if (!item) throw new Error('Item not found');
        
        currentDetailItem = { source, itemId, title };
        displayItemDetail(item, source);
        
        // Load history
        loadItemHistory(source, itemId);
        
        document.getElementById('itemDetailModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading item details:', error);
        showErrorMessage('Failed to load item details');
    }
}

// Display item detail modal content
function displayItemDetail(item, source) {
    const modal = document.getElementById('itemDetailContent');
    
    const stockQuantity = item.quantity_on_hand || item.quantity || 0;
    const stockStatus = stockQuantity === 0 ? 'out-of-stock' : 
                       stockQuantity < 10 ? 'low-stock' : '';
    
    modal.innerHTML = `
        <div class="detail-header">
            <div>
                <h2>${escapeHtml(item.item_name || item.title)}</h2>
                <span class="source-badge ${source}">${source === 'csv' ? 'CSV' : 'MANUAL'}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Item Information</h3>
            <div class="detail-row">
                <span class="detail-label">Item ID:</span>
                <span class="detail-value">${source === 'csv' ? item.item_id : item.isbn}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Title:</span>
                <span class="detail-value">${escapeHtml(item.item_name || item.title)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Grade Level:</span>
                <span class="detail-value">${escapeHtml(item.grade_level || 'N/A')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Subject:</span>
                <span class="detail-value">${escapeHtml(item.category || item.subject || 'N/A')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Publisher:</span>
                <span class="detail-value">${escapeHtml(item.publisher || 'N/A')}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Stock Information</h3>
            <div class="detail-row">
                <span class="detail-label">Current Stock:</span>
                <span class="detail-value ${stockStatus}">${stockQuantity}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Unit Price:</span>
                <span class="detail-value">${formatPrice(item.unit_price || item.price)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Recent Adjustments</h3>
            <div class="history-list">
                <div class="history-loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading history...
                </div>
            </div>
        </div>
    `;
}

// Load item history
async function loadItemHistory(source, itemId) {
    try {
        const params = source === 'csv' ? `item_id=${itemId}` : `book_id=${itemId}`;
        const response = await fetch(`../backend/api/catalogue/get_history.php?${params}&limit=10`);
        
        if (!response.ok) throw new Error('Failed to load history');
        
        const data = await response.json();
        const history = data.history || [];
        
        displayHistory(history);
    } catch (error) {
        console.error('Error loading history:', error);
        const historyList = document.querySelector('.history-list');
        if (historyList) {
            historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No adjustment history available</p>';
        }
    }
}

// Display history timeline
function displayHistory(history) {
    const historyList = document.querySelector('.history-list');
    
    if (history.length === 0) {
        historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No adjustment history</p>';
        return;
    }
    
    historyList.innerHTML = `
        <div class="history-items">
            ${history.map(item => `
                <div class="history-item">
                    <span class="history-date">${formatDate(item.adjusted_at)}</span>
                    <span class="history-change ${item.quantity_change > 0 ? 'positive' : 'negative'}">
                        ${item.quantity_change > 0 ? '+' : ''}${item.quantity_change}
                    </span>
                    <span class="history-reason">${escapeHtml(item.reason || 'No reason provided')}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Edit item
function editItem(itemId, source) {
    const item = allItems.find(i => 
        (source === 'csv' ? i.item_id === itemId : i.book_id === itemId)
    );
    
    if (!item) return;
    
    document.getElementById('bookModalTitle').textContent = 'Edit Book';
    document.getElementById('bookTitle').value = item.item_name || item.title;
    document.getElementById('bookISBN').value = item.isbn || item.item_id || '';
    document.getElementById('bookAuthor').value = item.author || '';
    document.getElementById('bookGrade').value = item.grade_level || '';
    document.getElementById('bookCategory').value = item.category || item.subject || '';
    document.getElementById('bookPrice').value = item.unit_price || item.price || '';
    document.getElementById('bookStock').value = item.quantity_on_hand || item.quantity || 0;
    
    document.getElementById('bookForm').onsubmit = (e) => saveBook(e, itemId, source);
    document.getElementById('bookModal').style.display = 'block';
}

// Show add book modal
function showAddBookModal() {
    document.getElementById('bookModalTitle').textContent = 'Add New Book';
    document.getElementById('bookForm').reset();
    document.getElementById('bookForm').onsubmit = (e) => saveBook(e);
    document.getElementById('bookModal').style.display = 'block';
}

// Save book
async function saveBook(event, itemId = null, source = null) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('bookTitle').value,
        isbn: document.getElementById('bookISBN').value,
        author: document.getElementById('bookAuthor').value,
        grade_level: document.getElementById('bookGrade').value,
        category: document.getElementById('bookCategory').value,
        unit_price: parseFloat(document.getElementById('bookPrice').value) || 0,
        quantity_on_hand: parseInt(document.getElementById('bookStock').value)
    };
    
    try {
        if (itemId) {
            // Edit existing item
            const endpoint = source === 'csv' ? 
                '../backend/api/catalogue/update_item.php' : 
                '../backend/api/catalogue/update_item.php';
            
            formData[source === 'csv' ? 'item_id' : 'book_id'] = itemId;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) throw new Error('Failed to update book');
        } else {
            // Create new item
            const response = await fetch('../backend/api/catalogue/create_item.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) throw new Error('Failed to create book');
        }
        
        closeBookModal();
        loadInventory();
        showSuccessMessage(itemId ? 'Book updated successfully' : 'Book added successfully');
    } catch (error) {
        console.error('Error saving book:', error);
        showErrorMessage('Failed to save book');
    }
}

// Close detail modal
function closeDetailModal() {
    document.getElementById('itemDetailModal').style.display = 'none';
    currentDetailItem = null;
}

// Close book modal
function closeBookModal() {
    document.getElementById('bookModal').style.display = 'none';
}

// Show bulk actions menu
function showBulkActionsMenu() {
    if (selectedItems.size === 0) {
        showErrorMessage('Please select items first');
        return;
    }
    // Show the bulk actions panel
    document.getElementById('bulkActionsPanel').classList.add('active');
    // Reset input fields
    document.getElementById('bulkQuantityAdd').value = '';
    document.getElementById('bulkQuantityDeduct').value = '';
}

// Close bulk actions menu
function closeBulkActionsMenu() {
    document.getElementById('bulkActionsPanel').classList.remove('active');
}

// Bulk Add Quantity
async function bulkAddQuantity() {
    const quantity = parseInt(document.getElementById('bulkQuantityAdd').value);
    if (!quantity || quantity < 1) {
        showErrorMessage('Please enter a valid quantity');
        return;
    }
    
    if (selectedItems.size === 0) {
        showErrorMessage('No items selected');
        return;
    }
    
    try {
        let successCount = 0;
        let failureCount = 0;
        
        for (const itemId of selectedItems) {
            const item = allItems.find(i => i.item_id == itemId);
            if (!item) continue;
            
            const payload = {
                item_id: itemId,
                adjustment_amount: quantity,
                reason: 'Bulk add',
                notes: 'Bulk adjustment from inventory page'
            };
            
            const response = await fetch('../backend/api/catalogue/adjust_stock.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await parseJsonOrText(response);
            if (response.ok && data.success) {
                successCount++;
            } else {
                console.error('Adjustment error:', data.error);
                failureCount++;
            }
        }
        
        showSuccessMessage(`Added quantity to ${successCount} item(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        closeBulkActionsMenu();
        selectedItems.clear();
        loadInventory();
    } catch (error) {
        console.error('Bulk add error:', error);
        showErrorMessage('Error adding quantity to items: ' + error.message);
    }
}

// Bulk Deduct Quantity
async function bulkDeductQuantity() {
    const quantity = parseInt(document.getElementById('bulkQuantityDeduct').value);
    if (!quantity || quantity < 1) {
        showErrorMessage('Please enter a valid quantity');
        return;
    }
    
    if (selectedItems.size === 0) {
        showErrorMessage('No items selected');
        return;
    }
    
    try {
        let successCount = 0;
        let failureCount = 0;
        
        for (const itemId of selectedItems) {
            const item = allItems.find(i => i.item_id == itemId);
            if (!item) continue;
            
            const payload = {
                item_id: itemId,
                adjustment_amount: quantity,  // Send positive value
                reason: 'Bulk deduct',
                notes: 'Bulk adjustment from inventory page'
            };
            
            const response = await fetch('../backend/api/catalogue/adjust_stock.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await parseJsonOrText(response);
            if (response.ok && data.success) {
                successCount++;
            } else {
                console.error('Adjustment error:', data.error);
                failureCount++;
            }
        }
        
        showSuccessMessage(`Deducted quantity from ${successCount} item(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        closeBulkActionsMenu();
        selectedItems.clear();
        loadInventory();
    } catch (error) {
        console.error('Bulk deduct error:', error);
        showErrorMessage('Error deducting quantity from items: ' + error.message);
    }
}

// Bulk Add to Favourites
async function bulkAddFavourites() {
    if (selectedItems.size === 0) {
        showErrorMessage('No items selected');
        return;
    }
    
    try {
        let successCount = 0;
        let failureCount = 0;
        
        for (const itemId of selectedItems) {
            const item = allItems.find(i => i.item_id == itemId);
            if (!item) continue;
            
            // Skip if already favourite
            if (item.is_favourite) continue;
            
            const response = await fetch('../backend/api/catalogue/favourites.php?action=add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ item_id: itemId })
            });
            
            const data = await parseJsonOrText(response);
            if (response.ok && data.success) {
                successCount++;
            } else {
                console.error('Favourite error:', data.error);
                failureCount++;
            }
        }
        
        showSuccessMessage(`Added ${successCount} item(s) to favourites${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        closeBulkActionsMenu();
        loadInventory();
    } catch (error) {
        console.error('Bulk favourites error:', error);
        showErrorMessage('Error adding items to favourites: ' + error.message);
    }
}

// Bulk Update Threshold
async function bulkUpdateThreshold() {
    const threshold = parseInt(document.getElementById('bulkThresholdValue').value);
    if (!threshold || threshold < 1) {
        showErrorMessage('Please enter a valid threshold value');
        return;
    }
    
    if (selectedItems.size === 0) {
        showErrorMessage('No items selected');
        return;
    }
    
    try {
        let successCount = 0;
        let failureCount = 0;
        
        for (const itemId of selectedItems) {
            const item = allItems.find(i => i.item_id == itemId);
            if (!item) continue;
            
            const payload = {
                item_id: itemId,
                threshold: threshold
            };
            
            const response = await fetch('../backend/api/catalogue/low_stock_alerts.php?action=set_threshold', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await parseJsonOrText(response);
            if (response.ok && data.success) {
                successCount++;
            } else {
                console.error('Threshold error:', data.error);
                failureCount++;
            }
        }
        
        showSuccessMessage(`Updated threshold for ${successCount} item(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        closeBulkActionsMenu();
        document.getElementById('bulkThresholdValue').value = '';
        loadInventory();
    } catch (error) {
        console.error('Bulk threshold error:', error);
        showErrorMessage('Error updating threshold: ' + error.message);
    }
}

// Real-time updates
let updateInterval;
function setupRealTimeUpdates() {
    updateInterval = setInterval(() => {
        if (currentDetailItem) {
            showItemDetail(currentDetailItem.source, currentDetailItem.itemId, currentDetailItem.title);
        }
        loadInventory();
    }, 60000); // Refresh every minute
}

// Utility functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
}

function formatPrice(price) {
    if (!price) return '$0.00';
    
    // Handle "JMD 2390.00" format
    if (typeof price === 'string' && price.includes('JMD')) {
        const match = price.match(/[\d.]+/);
        price = match ? parseFloat(match[0]) : 0;
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(parseFloat(price));
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showErrorMessage(message) {
    console.error(message);
    // TODO: Implement toast notification
}

function showSuccessMessage(message) {
    console.log(message);
    // TODO: Implement toast notification
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
});

// Toggle favourite
function toggleFavourite(itemId, source, button) {
    const isFavourite = button.classList.contains('active');
    const action = isFavourite ? 'remove' : 'add';
    
    const payload = {};
    if (source === 'csv') {
        payload.item_id = itemId;
    } else {
        payload.book_id = itemId;
    }
    
    fetch(`../backend/api/catalogue/favourites.php?action=${action}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(async response => await parseJsonOrText(response))
    .then(data => {
        if (data.success) {
            button.classList.toggle('active');
            button.title = isFavourite ? 'Add to Favourites' : 'Remove from Favourites';
            showSuccessMessage(isFavourite ? 'Removed from Favourites' : 'Added to Favourites');
            loadInventory(); // Reload to update favourite status
        } else {
            console.error('Error toggling favourite:', data.error || 'Unknown error');
            showErrorMessage('Error: ' + (data.error || 'Failed to toggle favourite'));
        }
    })
    .catch(error => {
        console.error('Favourite toggle error:', error);
        showErrorMessage('Error toggling favourite');
    });
}

// Helper to parse JSON responses safely even if server returns HTML error pages
async function parseJsonOrText(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (contentType.includes('application/json')) {
        try { return JSON.parse(text); } catch (e) { return { success: false, error: 'Invalid JSON response' }; }
    }
    try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; }
}
