// ==================== CATALOGUE MANAGEMENT ====================

// Global catalogue data
let catalogueData = {
    items: [],
    currentFilter: 'all'
};

// Initialize catalogue section
function initCatalogue() {
    console.log('Initializing catalogue...');
    loadCatalogue();
    setupCatalogueEventListeners();
}

// Load all catalogue items
function loadCatalogue() {
    fetch('../backend/api/search.php?action=search&limit=1000')
        .then(response => response.json())
        .then(data => {
            if (data.results) {
                // Convert search results to catalogue format
                catalogueData.items = data.results.map(item => ({
                    ...item,
                    source: 'all'
                }));
                displayCatalogueSearchResults(catalogueData.items);
            } else {
                console.error('Error loading catalogue:', data.error);
                document.getElementById('catalogueBody').innerHTML = 
                    '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #ef4444;">Error loading catalogue</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('catalogueBody').innerHTML = 
                '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #ef4444;">Failed to load catalogue</td></tr>';
        });
}

// Display catalogue items in table
function displayCatalogue(items) {
    const tbody = document.getElementById('catalogueBody');
    
    // Apply current filter
    let filteredItems = items;
    if (catalogueData.currentFilter === 'csv') {
        filteredItems = items.filter(item => item.source === 'csv');
    } else if (catalogueData.currentFilter === 'manual') {
        filteredItems = items.filter(item => item.source === 'manual');
    }
    
    if (!filteredItems || filteredItems.length === 0) {
        const filterText = catalogueData.currentFilter === 'csv' ? 'No CSV imported items' :
                          catalogueData.currentFilter === 'manual' ? 'No manually added items' : 'No items in catalogue';
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">${filterText}</td></tr>`;
        return;
    }
    
    let html = '';
    filteredItems.forEach(item => {
        const stock = parseInt(item.quantity_on_hand) || 0;
        const stockClass = stock === 0 ? 'out-of-stock' : (stock < 10 ? 'low-stock' : '');
        const stockWarning = stock < 10 && stock > 0 ? '<i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-left: 5px;"></i>' : '';
        const sourceBadge = item.source === 'csv' ? '<span class="source-badge csv">CSV</span>' : '<span class="source-badge manual">Manual</span>';
        
        // Use book_id for manual items, item_id for CSV items
        const itemId = item.source === 'csv' ? item.item_id : item.book_id;
        const displayIsbn = item.isbn || item.item_id || 'N/A';
        
        html += `
            <tr data-source="${item.source}">
                <td>${sourceBadge} ${escapeHtml(displayIsbn)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.author || 'N/A')}</td>
                <td>${escapeHtml(item.category || 'N/A')}</td>
                <td>$${parseFloat(item.unit_price).toFixed(2)}</td>
                <td class="${stockClass}">${stock}${stockWarning}</td>
                <td>
                    <button class="btn-icon" onclick="editItem(${escapeHtml(itemId)}, '${item.source}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="showAdjustModal('${item.source}', ${escapeHtml(itemId)}, ${stock}, '${escapeHtml(item.title)}')" title="Adjust Stock">
                        <i class="fas fa-arrows-alt-v"></i>
                    </button>
                    <button class="btn-icon" onclick="viewHistory('${item.source}', ${escapeHtml(itemId)}, '${escapeHtml(item.title)}')" title="View History">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Setup event listeners
function setupCatalogueEventListeners() {
    // Item form submission
    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.removeEventListener('submit', handleItemSubmit);
        itemForm.addEventListener('submit', handleItemSubmit);
    }
    
    // Adjust form submission
    const adjustForm = document.getElementById('adjustForm');
    if (adjustForm) {
        adjustForm.removeEventListener('submit', handleAdjustSubmit);
        adjustForm.addEventListener('submit', handleAdjustSubmit);
    }
    
    // Reason dropdown change
    const reasonSelect = document.getElementById('reason');
    if (reasonSelect) {
        reasonSelect.removeEventListener('change', toggleOtherReasonField);
        reasonSelect.addEventListener('change', toggleOtherReasonField);
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.removeEventListener('keyup', handleCatalogueSearch);
        searchInput.addEventListener('keyup', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleCatalogueSearch();
            }, 300);
        });
    }
    
    // Search button
    const searchButton = document.getElementById('catalogueSearchButton');
    if (searchButton) {
        searchButton.removeEventListener('click', handleCatalogueSearch);
        searchButton.addEventListener('click', handleCatalogueSearch);
    }
    
    // Grade filter
    const gradeFilter = document.getElementById('gradeFilter');
    if (gradeFilter) {
        gradeFilter.removeEventListener('change', handleCatalogueSearch);
        gradeFilter.addEventListener('change', handleCatalogueSearch);
    }
    
    // Subject filter
    const subjectFilter = document.getElementById('subjectFilter');
    if (subjectFilter) {
        subjectFilter.removeEventListener('change', handleCatalogueSearch);
        subjectFilter.addEventListener('change', handleCatalogueSearch);
    }
    
    // In stock only filter
    const inStockOnly = document.getElementById('inStockOnly');
    if (inStockOnly) {
        inStockOnly.removeEventListener('change', handleCatalogueSearch);
        inStockOnly.addEventListener('change', handleCatalogueSearch);
    }
    
    // Load filter options
    loadFilterOptions();
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// Toggle other reason field
function toggleOtherReasonField() {
    const reasonSelect = document.getElementById('reason');
    const otherReasonGroup = document.getElementById('otherReasonGroup');
    
    if (reasonSelect.value === 'Other') {
        otherReasonGroup.style.display = 'block';
        document.getElementById('otherReason').focus();
    } else {
        otherReasonGroup.style.display = 'none';
    }
}

// Filter catalogue by source (CSV or manual)
function filterBySource(source) {
    catalogueData.currentFilter = source;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${source}"]`).classList.add('active');
    
    // Re-display catalogue with filter applied
    displayCatalogue(catalogueData.items);
    
    // Clear search when changing filter
    document.getElementById('searchInput').value = '';
}

// Filter catalogue items based on search input
function filterCatalogue() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tableRows = document.querySelectorAll('#catalogueBody tr');
    let visibleCount = 0;
    
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;
        
        // Search in ISBN, Title, Author, and Category columns
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
        const tbody = document.getElementById('catalogueBody');
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

// Show create modal
function showCreateModal() {
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('itemForm').reset();
    document.getElementById('book_id').value = '';
    document.getElementById('isbn').disabled = false;
    document.getElementById('initial_quantity').value = '0';
    document.getElementById('initialQuantityGroup').style.display = 'block';
    document.getElementById('itemModal').style.display = 'block';
}

// Edit item
function editItem(bookId, source) {
    // Check if this is a CSV item - show as read-only
    if (source === 'csv') {
        alert('CSV imported items cannot be edited directly. Please adjust stock quantities or delete and re-import if needed.');
        return;
    }
    
    // For manual items, load and edit normally
    fetch('../backend/api/catalogue/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const item = data.items.find(i => i.book_id == bookId && i.source === 'manual');
                if (item) {
                    document.getElementById('modalTitle').textContent = 'Edit Item';
                    document.getElementById('book_id').value = item.book_id;
                    document.getElementById('isbn').value = item.isbn;
                    document.getElementById('isbn').disabled = true;
                    document.getElementById('title').value = item.title;
                    document.getElementById('author').value = item.author || '';
                    document.getElementById('publisher').value = item.publisher || '';
                    document.getElementById('category').value = item.category || '';
                    document.getElementById('unit_price').value = item.unit_price;
                    document.getElementById('reorder_level').value = item.reorder_level || 10;
                    document.getElementById('description').value = item.description || '';
                    document.getElementById('initialQuantityGroup').style.display = 'none';
                    
                    document.getElementById('itemModal').style.display = 'block';
                } else {
                    alert('Item not found');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error loading item details');
        });
}

// Handle item form submission (create or update)
function handleItemSubmit(e) {
    e.preventDefault();
    
    const bookId = document.getElementById('book_id').value;
    const formData = {
        isbn: document.getElementById('isbn').value,
        title: document.getElementById('title').value,
        author: document.getElementById('author').value,
        publisher: document.getElementById('publisher').value,
        category: document.getElementById('category').value,
        unit_price: parseFloat(document.getElementById('unit_price').value),
        description: document.getElementById('description').value,
        reorder_level: parseInt(document.getElementById('reorder_level').value)
    };
    
    let url, method;
    if (bookId) {
        // Update existing item
        url = '../backend/api/catalogue/update_item.php';
        method = 'PUT';
        formData.book_id = bookId;
    } else {
        // Create new item
        url = '../backend/api/catalogue/create_item.php';
        method = 'POST';
        formData.initial_quantity = parseInt(document.getElementById('initial_quantity').value) || 0;
    }
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('itemModal').style.display = 'none';
            loadCatalogue();
            alert(data.message || 'Item saved successfully');
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to save item');
    });
}

// Show adjust stock modal
function showAdjustModal(source, itemId, currentStock, title) {
    if (source === 'csv') {
        // For CSV items, store item_id as string
        document.getElementById('adjust_book_id').value = itemId;
        document.getElementById('adjust_source').value = 'csv';
    } else {
        // For manual items, store book_id as number
        document.getElementById('adjust_book_id').value = itemId;
        document.getElementById('adjust_source').value = 'manual';
    }
    document.getElementById('current_quantity').value = currentStock;
    document.getElementById('itemNameDisplay').textContent = title;
    document.getElementById('adjustForm').reset();
    document.getElementById('current_quantity').value = currentStock;
    document.getElementById('adjustModal').style.display = 'block';
    updateAdjustmentLabel();
}

// Handle stock adjustment submission
function handleAdjustSubmit(e) {
    e.preventDefault();
    
    const bookId = document.getElementById('adjust_book_id').value;
    const source = document.getElementById('adjust_source').value;
    const adjustmentType = document.getElementById('adjustment_type').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const currentStock = parseInt(document.getElementById('current_quantity').value);
    let reason = document.getElementById('reason').value;
    
    // Validate reason is selected
    if (!reason || reason === '') {
        alert('Adjustment reason is required');
        return;
    }
    
    // If "Other" is selected, append the custom reason
    if (reason === 'Other') {
        const otherReason = document.getElementById('otherReason').value.trim();
        if (otherReason) {
            reason = 'Other: ' + otherReason;
        } else {
            alert('Please provide details for the "Other" reason');
            return;
        }
    }
    
    let adjustmentAmount = 0;
    
    if (adjustmentType === 'add') {
        adjustmentAmount = quantity;
    } else if (adjustmentType === 'remove') {
        adjustmentAmount = -quantity;
    } else if (adjustmentType === 'set') {
        adjustmentAmount = quantity - currentStock;
    }
    
    // Validate stock won't go negative
    const newStock = currentStock + adjustmentAmount;
    if (newStock < 0) {
        alert(`Cannot reduce stock below zero.\nCurrent Stock: ${currentStock}\nAttempted Adjustment: ${adjustmentAmount}\nWould Result in: ${newStock}`);
        return;
    }
    
    if (!confirm(`Confirm stock adjustment of ${adjustmentAmount > 0 ? '+' : ''}${adjustmentAmount}?`)) {
        return;
    }
    
    fetch('../backend/api/catalogue/adjust_stock.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            book_id: bookId,
            source: source,
            adjustment_amount: adjustmentAmount,
            reason: reason
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('adjustModal').style.display = 'none';
            loadCatalogue();
            alert(`Stock adjusted: ${data.old_stock} → ${data.new_stock}`);
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to adjust stock');
    });
}

// View adjustment history
function viewHistory(source, itemId, title) {
    document.getElementById('historyTitle').textContent = title + ' - Stock History';
    document.getElementById('historyModal').style.display = 'block';
    
    // Use book_id for manual items, item_id for CSV items
    const queryParam = source === 'csv' ? `item_id=${itemId}` : `book_id=${itemId}`;
    
    fetch(`../backend/api/catalogue/get_history.php?${queryParam}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.history) {
                const historyBody = document.getElementById('historyBody');
                let html = '';
                
                data.history.forEach(record => {
                    // Parse timestamp properly
                    const date = new Date(record.timestamp || record.date);
                    const formattedDate = isNaN(date.getTime()) 
                        ? (record.timestamp || record.date || 'N/A')
                        : date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    
                    // Format change with +/- prefix
                    const change = record.quantity_change !== null && record.quantity_change !== undefined
                        ? (record.quantity_change > 0 ? '+' : '') + record.quantity_change
                        : 'N/A';
                    
                    // Get action type
                    const type = record.action_type || record.type || 'N/A';
                    
                    // Get reason
                    const reason = record.adjustment_reason || record.reason || 'N/A';
                    
                    html += `
                        <tr>
                            <td>${escapeHtml(formattedDate)}</td>
                            <td>${escapeHtml(change)}</td>
                            <td>${escapeHtml(type)}</td>
                            <td>${escapeHtml(reason)}</td>
                        </tr>
                    `;
                });
                
                historyBody.innerHTML = html || '<tr><td colspan="4" style="text-align: center; padding: 20px;">No history available</td></tr>';
            } else {
                const historyBody = document.getElementById('historyBody');
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No history available</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error loading history:', error);
            const historyBody = document.getElementById('historyBody');
            historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Error loading history</td></tr>';
        });
}

// Display history items
function displayHistory(history) {
    const historyBody = document.getElementById('historyBody');
    
    if (!history || history.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No history available</td></tr>';
        return;
    }
    
    let html = '';
    history.forEach(item => {
        let dateStr = 'N/A';
        let changeStr = 'N/A';
        let typeStr = item.action_type || 'N/A';
        let reasonStr = 'N/A';
        
        // Format date
        if (item.timestamp) {
            try {
                const date = new Date(item.timestamp);
                dateStr = date.toLocaleString();
            } catch (e) {
                dateStr = item.timestamp;
            }
        }
        
        // Format change and reason based on action type
        if (item.action_type === 'ADJUST_STOCK') {
            if (item.quantity_change) {
                const change = parseInt(item.quantity_change);
                changeStr = `${change > 0 ? '+' : ''}${change}`;
            }
            reasonStr = item.adjustment_reason || 'N/A';
        } else if (item.action_type === 'UPDATE') {
            changeStr = `${item.old_value} → ${item.new_value}`;
            reasonStr = item.field_changed || 'N/A';
        } else if (item.action_type === 'CREATE') {
            changeStr = 'Item created';
            reasonStr = 'Initial creation';
        }
        
        html += `
            <tr>
                <td>${escapeHtml(dateStr)}</td>
                <td>${escapeHtml(changeStr)}</td>
                <td>${escapeHtml(typeStr)}</td>
                <td>${escapeHtml(reasonStr)}</td>
            </tr>
        `;
    });
    
    historyBody.innerHTML = html;
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load grade and subject filter options
async function loadFilterOptions() {
    try {
        const response = await fetch('../backend/api/search.php?action=search&limit=1000', {
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.results) {
            // Extract unique grades and subjects
            const grades = new Set();
            const subjects = new Set();
            
            data.results.forEach(item => {
                if (item.grade_level) grades.add(item.grade_level);
                if (item.subject_category) subjects.add(item.subject_category);
            });
            
            // Populate grade filter
            const gradeFilter = document.getElementById('gradeFilter');
            grades.forEach(grade => {
                const option = document.createElement('option');
                option.value = grade;
                option.textContent = grade;
                gradeFilter.appendChild(option);
            });
            
            // Populate subject filter
            const subjectFilter = document.getElementById('subjectFilter');
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

// Handle catalogue search with API
async function handleCatalogueSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    const grade = document.getElementById('gradeFilter').value;
    const subject = document.getElementById('subjectFilter').value;
    const inStockOnly = document.getElementById('inStockOnly').checked;
    
    try {
        // Build query parameters
        let query = '../backend/api/search.php?action=search&limit=1000';
        if (searchTerm) {
            query += `&q=${encodeURIComponent(searchTerm)}`;
        }
        if (grade) {
            query += `&grade=${encodeURIComponent(grade)}`;
        }
        if (subject) {
            query += `&subject=${encodeURIComponent(subject)}`;
        }
        
        const response = await fetch(query, {
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Filter by in-stock if checkbox is selected
        let results = data.results || [];
        if (inStockOnly) {
            results = results.filter(item => item.quantity > 0);
        }
        
        displayCatalogueSearchResults(results);
        
    } catch (error) {
        console.error('Error searching catalogue:', error);
        document.getElementById('catalogueBody').innerHTML = 
            `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #ef4444;">Error: ${error.message}</td></tr>`;
    }
}

// Display catalogue search results in table
function displayCatalogueSearchResults(results) {
    const tbody = document.getElementById('catalogueBody');
    
    if (!results || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No items found</td></tr>';
        return;
    }
    
    let html = '';
    results.forEach(item => {
        const stockClass = item.quantity > 0 ? '' : 'out-of-stock';
        const stockStatus = item.quantity > 0 ? 
            `<span style="color: #16a34a;">${item.quantity} in stock</span>` : 
            `<span style="color: #ef4444;">Out of stock</span>`;
        
        html += `
            <tr class="${stockClass}" style="cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f5f5f5';" onmouseout="this.style.backgroundColor='transparent';">
                <td onclick="window.location.href='item-details.html?id=${encodeURIComponent(item.item_id)}';" style="cursor: pointer;">${escapeHtml(item.item_id || '')}</td>
                <td onclick="window.location.href='item-details.html?id=${encodeURIComponent(item.item_id)}';" style="cursor: pointer;">${escapeHtml(item.item_name || '')}</td>
                <td onclick="window.location.href='item-details.html?id=${encodeURIComponent(item.item_id)}';" style="cursor: pointer;">${escapeHtml(item.grade_level || '-')}</td>
                <td onclick="window.location.href='item-details.html?id=${encodeURIComponent(item.item_id)}';" style="cursor: pointer;">${escapeHtml(item.subject_category || '-')}</td>
                <td onclick="window.location.href='item-details.html?id=${encodeURIComponent(item.item_id)}';" style="cursor: pointer;">$${item.rate || '0.00'}</td>
                <td onclick="window.location.href='item-details.html?id=${encodeURIComponent(item.item_id)}';" style="cursor: pointer;">${stockStatus}</td>
                <td>
                    <button class="btn-small" onclick="editItem(${item.item_id})" style="padding: 4px 8px; background: #0066ff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Edit
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}
