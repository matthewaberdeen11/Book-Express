// Search functionality for inventory tracking
let searchCache = {};
let searchDebounceTimer = null;
let currentDetailItem = null;

// Initialize search on page load
function initializeSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keypress', handleSearchKeypress);
    }
}

// Handle search input with debounce
function handleSearchInput(e) {
    clearTimeout(searchDebounceTimer);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        clearSearchResults();
        return;
    }
    
    searchDebounceTimer = setTimeout(() => {
        performSearch(query);
    }, 300); // 300ms debounce
}

// Handle Enter key on search
function handleSearchKeypress(e) {
    if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        const query = e.target.value.trim();
        if (query.length > 0) {
            performSearch(query);
        }
    }
}

// Perform search request
function performSearch(query, searchType = 'all', limit = 20, offset = 0) {
    const searchResultsContainer = document.getElementById('searchResults');
    
    // Show loading state
    if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    }
    
    fetch(`../backend/api/search/items.php?q=${encodeURIComponent(query)}&type=${searchType}&limit=${limit}&offset=${offset}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displaySearchResults(data.items, data.total, query);
                searchCache[query] = data;
            } else {
                showSearchError(data.error || 'Search failed');
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            showSearchError('Failed to perform search');
        });
}

// Display search results
function displaySearchResults(items, total, query) {
    const searchResultsContainer = document.getElementById('searchResults');
    
    if (!searchResultsContainer) return;
    
    if (items.length === 0) {
        searchResultsContainer.innerHTML = `
            <div class="search-no-results">
                <p>No items found for "${query}"</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="search-results-container">
            <div class="search-results-header">
                <span class="search-results-count">Found ${total} result${total !== 1 ? 's' : ''}</span>
            </div>
            <div class="search-results-list">
    `;
    
    items.forEach(item => {
        const stockClass = item.stock === 0 ? 'out-of-stock' : (item.stock < 10 ? 'low-stock' : '');
        const stockLabel = item.stock === 0 ? '<span class="out-of-stock-label">OUT OF STOCK</span>' : '';
        const sourceBadge = item.source === 'csv' ? '<span class="source-badge csv">CSV</span>' : '';
        const itemId = item.source === 'csv' ? item.item_id : item.book_id;
        
        html += `
            <div class="search-result-item ${stockClass}" onclick="showItemDetail('${item.source}', ${itemId}, '${escapeHtml(item.title)}')">
                <div class="search-result-header">
                    <div class="search-result-title-section">
                        <span class="search-result-title">${escapeHtml(item.title)}</span>
                        ${sourceBadge}
                    </div>
                    <div class="search-result-price">$${formatPrice(item.price)}</div>
                </div>
                <div class="search-result-details">
                    <span class="search-result-id">${item.isbn || item.item_id || 'N/A'}</span>
                    <span class="search-result-category">${escapeHtml(item.category)}</span>
                    <span class="search-result-stock ${stockClass}">
                        Stock: ${item.stock}
                        ${stockLabel}
                    </span>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    searchResultsContainer.innerHTML = html;
}

// Show item detail modal
function showItemDetail(source, itemId, title) {
    const modal = document.getElementById('itemDetailModal');
    if (!modal) return;
    
    // Load item details
    fetch(`../backend/api/catalogue/list.php`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                let item;
                if (source === 'csv') {
                    item = data.items.find(i => i.item_id == itemId && i.source === 'csv');
                } else {
                    item = data.items.find(i => i.book_id == itemId && i.source === 'manual');
                }
                
                if (item) {
                    currentDetailItem = { ...item, source };
                    displayItemDetail(item, source);
                    
                    // Load and display history
                    loadItemHistory(source, itemId, title);
                }
            }
        })
        .catch(error => console.error('Error loading item details:', error));
}

// Display item detail modal content
function displayItemDetail(item, source) {
    const modal = document.getElementById('itemDetailModal');
    const detailContent = document.getElementById('itemDetailContent');
    
    if (!detailContent) return;
    
    const itemId = source === 'csv' ? item.item_id : item.book_id;
    const stock = item.source === 'csv' ? item.quantity : item.quantity_on_hand;
    const stockClass = stock === 0 ? 'out-of-stock' : (stock < 10 ? 'low-stock' : '');
    const stockLabel = stock === 0 ? '<span class="out-of-stock-label">OUT OF STOCK</span>' : '';
    
    let detailHtml = `
        <div class="detail-header">
            <h2>${escapeHtml(item.title)}</h2>
            <span class="source-badge ${source === 'csv' ? 'csv' : 'manual'}">${source.toUpperCase()}</span>
        </div>
        
        <div class="detail-section">
            <div class="detail-row">
                <span class="detail-label">Item ID:</span>
                <span class="detail-value">${escapeHtml(itemId)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">ISBN:</span>
                <span class="detail-value">${escapeHtml(item.isbn || 'N/A')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Grade Level:</span>
                <span class="detail-value">${escapeHtml(item.grade_level || 'N/A')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Subject/Category:</span>
                <span class="detail-value">${escapeHtml(item.category || 'N/A')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Publisher:</span>
                <span class="detail-value">${escapeHtml(item.publisher || 'N/A')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Current Stock:</span>
                <span class="detail-value ${stockClass}">
                    ${stock}
                    ${stockLabel}
                </span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Price:</span>
                <span class="detail-value">$${formatPrice(item.unit_price)}</span>
            </div>
    `;
    
    if (item.description) {
        detailHtml += `
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${escapeHtml(item.description)}</span>
            </div>
        `;
    }
    
    detailHtml += `
        </div>
        
        <div class="detail-section">
            <h3>Recent Inventory Adjustments</h3>
            <div id="itemHistoryList" class="history-list">
                <div class="history-loading"><i class="fas fa-spinner fa-spin"></i> Loading history...</div>
            </div>
        </div>
    `;
    
    detailContent.innerHTML = detailHtml;
    modal.style.display = 'block';
}

// Load item history
function loadItemHistory(source, itemId, title) {
    const historyList = document.getElementById('itemHistoryList');
    if (!historyList) return;
    
    const queryParam = source === 'csv' ? `item_id=${itemId}` : `book_id=${itemId}`;
    
    fetch(`../backend/api/catalogue/get_history.php?${queryParam}&limit=10`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.history) {
                displayHistory(data.history);
            } else {
                historyList.innerHTML = '<p>No adjustment history available</p>';
            }
        })
        .catch(error => {
            console.error('Error loading history:', error);
            historyList.innerHTML = '<p>Error loading history</p>';
        });
}

// Display history in detail modal
function displayHistory(history) {
    const historyList = document.getElementById('itemHistoryList');
    if (!historyList) return;
    
    if (history.length === 0) {
        historyList.innerHTML = '<p>No adjustment history</p>';
        return;
    }
    
    let html = '<div class="history-items">';
    
    history.forEach(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleString();
        
        let changeStr = 'N/A';
        if (item.action_type === 'ADJUST_STOCK' && item.quantity_change) {
            const change = parseInt(item.quantity_change);
            changeStr = `${change > 0 ? '+' : ''}${change}`;
        }
        
        html += `
            <div class="history-item">
                <div class="history-date">${dateStr}</div>
                <div class="history-change">${changeStr}</div>
                <div class="history-reason">${escapeHtml(item.adjustment_reason || item.field_changed || 'N/A')}</div>
            </div>
        `;
    });
    
    html += '</div>';
    historyList.innerHTML = html;
}

// Refresh search results (for real-time updates)
function refreshSearchResults() {
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput && searchInput.value.trim().length > 0) {
        performSearch(searchInput.value.trim());
    }
    
    if (currentDetailItem) {
        showItemDetail(currentDetailItem.source, 
                      currentDetailItem.source === 'csv' ? currentDetailItem.item_id : currentDetailItem.book_id,
                      currentDetailItem.title);
    }
}

// Clear search results
function clearSearchResults() {
    const searchResultsContainer = document.getElementById('searchResults');
    if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '';
    }
}

// Show search error
function showSearchError(error) {
    const searchResultsContainer = document.getElementById('searchResults');
    if (searchResultsContainer) {
        searchResultsContainer.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-circle"></i> ${escapeHtml(error)}
            </div>
        `;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format price
function formatPrice(price) {
    if (typeof price === 'string') {
        // Handle CSV rate strings like "JMD 2390.00"
        const priceMatch = price.match(/[\d.]+/);
        return priceMatch ? parseFloat(priceMatch[0]).toFixed(2) : '0.00';
    }
    return parseFloat(price).toFixed(2);
}

// Close detail modal
function closeDetailModal() {
    const modal = document.getElementById('itemDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Set up polling for real-time updates (every 5 seconds)
function setupRealTimeUpdates() {
    setInterval(() => {
        refreshSearchResults();
    }, 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSearch();
    setupRealTimeUpdates();
});
