// ==================== CATALOGUE MANAGEMENT ====================

//global catalogue data
let catalogueData = {
    items: [],
    currentFilter: 'all'
};

//initialize catalogue page
function initCatalogue() {
    console.log('Initializing catalogue...');
    loadCatalogue();
    setupCatalogueEventListeners();
}

//load catalogue items from backend
function loadCatalogue() {
    fetch('../backend/api/catalogue/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                //store items globally
                catalogueData.items = data.items;
                displayCatalogue(catalogueData.items);
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

//display catalogue items in table
function displayCatalogue(items) {
    const tbody = document.getElementById('catalogueBody');
    
    //apply current filter
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
        
        //use item_id for CSV items, book_id for manual items
        const itemId = item.source === 'csv' ? item.item_id : item.book_id;
        const displayIsbn = item.isbn || item.item_id || 'N/A';
        
        // For CSV items, wrap itemId in quotes since it's a string
        const itemIdParam = item.source === 'csv' ? `'${escapeHtml(itemId)}'` : escapeHtml(itemId);
        
        html += `
            <tr data-source="${item.source}">
                <td>${sourceBadge} ${escapeHtml(displayIsbn)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.author || 'N/A')}</td>
                <td>${escapeHtml(item.category || 'N/A')}</td>
                <td>$${parseFloat(item.unit_price).toFixed(2)}</td>
                <td class="${stockClass}">${stock}${stockWarning}</td>
                <td>
                    <button class="btn-icon" onclick="editItem(${itemIdParam}, '${item.source}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="showAdjustModal('${item.source}', ${itemIdParam}, ${stock}, '${escapeHtml(item.title)}')" title="Adjust Stock">
                        <i class="fas fa-arrows-alt-v"></i>
                    </button>
                    <button class="btn-icon" onclick="viewHistory('${item.source}', ${itemIdParam}, '${escapeHtml(item.title)}')" title="View History">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

//setup event listeners for catalogue page
function setupCatalogueEventListeners() {
    //item form 
    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.removeEventListener('submit', handleItemSubmit);
        itemForm.addEventListener('submit', handleItemSubmit);
    }
    
    //adjust form submission
    const adjustForm = document.getElementById('adjustForm');
    if (adjustForm) {
        adjustForm.removeEventListener('submit', handleAdjustSubmit);
        adjustForm.addEventListener('submit', handleAdjustSubmit);
    }
    
    //reason dropdown bar change
    const reasonSelect = document.getElementById('reason');
    if (reasonSelect) {
        reasonSelect.removeEventListener('change', toggleOtherReasonField);
        reasonSelect.addEventListener('change', toggleOtherReasonField);
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.removeEventListener('keyup', filterCatalogue);
        searchInput.addEventListener('keyup', filterCatalogue);
    }
    
    //modal closes on outside click
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

//other reason field toggle
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

//filter catalogue by source
function filterBySource(source) {
    catalogueData.currentFilter = source;
    
    //activate button update
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${source}"]`).classList.add('active');
    
    //redisplay catalogue
    displayCatalogue(catalogueData.items);
    
    // Clear search when changing filter
    document.getElementById('searchInput').value = '';
}

// filter catalogue by search term
function filterCatalogue() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tableRows = document.querySelectorAll('#catalogueBody tr');
    let visibleCount = 0;
    
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;
        
        //search in ISBN, Title, Author, and Category columns
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
    
    //show no results message if nothing matches
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
        //remove no results message if search is cleared
        const noResultsRow = document.querySelector('.no-results');
        if (noResultsRow) {
            noResultsRow.remove();
        }
    }
}

//show create modal
function showCreateModal() {
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('itemForm').reset();
    document.getElementById('book_id').value = '';
    document.getElementById('item_id').value = '';
    document.getElementById('item_source').value = 'manual';
    document.getElementById('isbn').disabled = false;
    document.getElementById('author').disabled = false;
    document.getElementById('publisher').disabled = false;
    document.getElementById('description').disabled = false;
    document.getElementById('initial_quantity').value = '0';
    document.getElementById('initialQuantityGroup').style.display = 'block';
    document.getElementById('itemModal').style.display = 'block';
}

//edit item
function editItem(itemId, source) {
    fetch('../backend/api/catalogue/list.php')
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
                    document.getElementById('modalTitle').textContent = 'Edit Item';
                    
                    if (source === 'csv') {
                        // CSV item editing
                        document.getElementById('book_id').value = '';
                        document.getElementById('item_id').value = item.item_id;
                        document.getElementById('item_source').value = 'csv';
                        document.getElementById('isbn').value = item.item_id;
                        document.getElementById('isbn').disabled = true;
                        document.getElementById('title').value = item.title;
                        document.getElementById('author').value = '';
                        document.getElementById('author').disabled = true;
                        document.getElementById('publisher').value = '';
                        document.getElementById('publisher').disabled = true;
                        document.getElementById('category').value = item.category || '';
                        document.getElementById('unit_price').value = item.unit_price;
                        document.getElementById('reorder_level').value = item.reorder_level || 10;
                        document.getElementById('description').value = '';
                        document.getElementById('description').disabled = true;
                    } else {
                        // Manual item editing
                        document.getElementById('book_id').value = item.book_id;
                        document.getElementById('item_id').value = '';
                        document.getElementById('item_source').value = 'manual';
                        document.getElementById('isbn').value = item.isbn;
                        document.getElementById('isbn').disabled = true;
                        document.getElementById('title').value = item.title;
                        document.getElementById('author').value = item.author || '';
                        document.getElementById('author').disabled = false;
                        document.getElementById('publisher').value = item.publisher || '';
                        document.getElementById('publisher').disabled = false;
                        document.getElementById('category').value = item.category || '';
                        document.getElementById('unit_price').value = item.unit_price;
                        document.getElementById('reorder_level').value = item.reorder_level || 10;
                        document.getElementById('description').value = item.description || '';
                        document.getElementById('description').disabled = false;
                    }
                    
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

//handle item form submission
function handleItemSubmit(e) {
    e.preventDefault();
    
    const bookId = document.getElementById('book_id').value;
    const itemId = document.getElementById('item_id').value;
    const source = document.getElementById('item_source').value;
    
    const formData = {
        title: document.getElementById('title').value,
        category: document.getElementById('category').value,
        unit_price: parseFloat(document.getElementById('unit_price').value),
        reorder_level: parseInt(document.getElementById('reorder_level').value)
    };
    
    // Add fields specific to manual items
    if (source !== 'csv') {
        formData.isbn = document.getElementById('isbn').value;
        formData.author = document.getElementById('author').value;
        formData.publisher = document.getElementById('publisher').value;
        formData.description = document.getElementById('description').value;
    }
    
    let url, method;
    if (bookId || itemId) {
        //update existing item
        url = '../backend/api/catalogue/update_item.php';
        method = 'PUT';
        
        if (source === 'csv') {
            formData.item_id = itemId;
            formData.source = 'csv';
        } else {
            formData.book_id = bookId;
            formData.source = 'manual';
        }
    } else {
        //create new item (manual only)
        url = '../backend/api/catalogue/create_item.php';
        method = 'POST';
        formData.isbn = document.getElementById('isbn').value;
        formData.author = document.getElementById('author').value;
        formData.publisher = document.getElementById('publisher').value;
        formData.description = document.getElementById('description').value;
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

//show adjust stock modal
function showAdjustModal(source, itemId, currentStock, title) {
    if (source === 'csv') {
        //for CSV items, store item_id as string
        document.getElementById('adjust_book_id').value = itemId;
        document.getElementById('adjust_source').value = 'csv';
    } else {
        //for manual items, store book_id as number
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

//stock adjustment submission
function handleAdjustSubmit(e) {
    e.preventDefault();
    
    const bookId = document.getElementById('adjust_book_id').value;
    const source = document.getElementById('adjust_source').value;
    const adjustmentType = document.getElementById('adjustment_type').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const currentStock = parseInt(document.getElementById('current_quantity').value);
    let reason = document.getElementById('reason').value;
    
    //validate reason is selected
    if (!reason || reason === '') {
        alert('Adjustment reason is required');
        return;
    }
    
    //if "Other" is selected, append the custom reason
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
    
    //prevent negative stock
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

//view stock history
function viewHistory(source, itemId, title) {
    document.getElementById('historyTitle').textContent = title + ' - Stock History';
    document.getElementById('historyModal').style.display = 'block';
    
    //use book_id for manual, item_id for CSV
    const queryParam = source === 'csv' ? `item_id=${itemId}` : `book_id=${itemId}`;
    
    fetch(`../backend/api/catalogue/get_history.php?${queryParam}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.history) {
                const historyBody = document.getElementById('historyBody');
                let html = '';
                
                data.history.forEach(record => {
                    //parse and format date
                    const date = new Date(record.timestamp || record.date);
                    const formattedDate = isNaN(date.getTime()) 
                        ? (record.timestamp || record.date || 'N/A')
                        : date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    
                    //format quantity change
                    const change = record.quantity_change !== null && record.quantity_change !== undefined
                        ? (record.quantity_change > 0 ? '+' : '') + record.quantity_change
                        : 'N/A';
                    
                    //get action type
                    const type = record.action_type || record.type || 'N/A';
                    
                    //get reason
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

//display history records
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
        
        //date formatting
        if (item.timestamp) {
            try {
                const date = new Date(item.timestamp);
                dateStr = date.toLocaleString();
            } catch (e) {
                dateStr = item.timestamp;
            }
        }
        
        //format change and reason based on action type
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

//close modal 
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

//escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
