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
        debounceSearch(e.target.value);
    });
    
    document.getElementById('gradeFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    
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
}

// Search debounce
let searchDebounceTimer;
function debounceSearch(query) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        applyFilters();
    }, 300);
}

// Load inventory from API
async function loadInventory() {
    try {
        const response = await fetch('../backend/api/catalogue/list.php', {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to load inventory');
        }
        
        allItems = data.items || [];
        filteredItems = [...allItems];
        displayInventory(filteredItems);
        updateSelectionCount();
    } catch (error) {
        console.error('Error loading inventory:', error);
        const tbody = document.getElementById('inventoryBody');
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger-color);">Error: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('inventorySearch').value.toLowerCase();
    const gradeFilter = document.getElementById('gradeFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    filteredItems = allItems.filter(item => {
        const itemTitle = (item.item_name || item.title || '').toLowerCase();
        const itemId = (item.isbn || item.item_id || '').toLowerCase();
        
        const matchesSearch = !searchTerm || 
            itemTitle.includes(searchTerm) ||
            itemId.includes(searchTerm);
        
        const matchesGrade = !gradeFilter || 
            (item.grade_level || '').toLowerCase().includes(gradeFilter.toLowerCase());
        
        const matchesCategory = !categoryFilter || 
            (item.category || '').toLowerCase().includes(categoryFilter.toLowerCase());
        
        return matchesSearch && matchesGrade && matchesCategory;
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
        const price = item.unit_price || 0;
        
        const stockClass = stock === 0 ? 'out-of-stock' : 
                          (stock < 10) ? 'low-stock' : '';
        const stockStatus = stock === 0 ? ' (Out of Stock)' : '';
        
        return `
            <tr class="${stockClass}">
                <td style="width: 40px;">
                    <input type="checkbox" class="item-checkbox" data-item-id="${itemId}" 
                           onchange="updateSelection()">
                </td>
                <td class="item-title" onclick="showItemDetail('${source}', ${itemId}, '${escapeHtml(itemTitle)}')">
                    ${escapeHtml(itemTitle)}
                </td>
                <td>${escapeHtml(gradeLevel)}</td>
                <td class="stock-cell">
                    <span class="stock-quantity ${stock === 0 ? 'out-of-stock' : ''}">${stock}</span>
                    ${stockStatus}
                </td>
                <td>${formatPrice(price)}</td>
                <td style="width: 100px;">
                    <button class="action-btn edit-btn" title="Edit" onclick="editItem(${itemId}, '${source}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
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
        const response = await fetch(`../backend/api/catalogue/list.php?${params}`, {
            credentials: 'same-origin'
        });
        
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
        const response = await fetch(`../backend/api/catalogue/get_history.php?${params}&limit=10`, {
            credentials: 'same-origin'
        });
        
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
                credentials: 'same-origin',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) throw new Error('Failed to update book');
        } else {
            // Create new item
            const response = await fetch('../backend/api/catalogue/create_item.php', {
                credentials: 'same-origin',
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
    // TODO: Implement bulk actions
    showErrorMessage('Bulk actions coming soon');
}

// Real-time updates
let updateInterval;
function setupRealTimeUpdates() {
    updateInterval = setInterval(() => {
        if (currentDetailItem) {
            showItemDetail(currentDetailItem.source, currentDetailItem.itemId, currentDetailItem.title);
        }
        loadInventory();
    }, 5000); // Refresh every 5 seconds
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
