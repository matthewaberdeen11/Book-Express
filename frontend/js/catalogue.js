// ==================== CATALOGUE MANAGEMENT ====================

// Initialize catalogue section
function initCatalogue() {
    console.log('Initializing catalogue...');
    loadCatalogue();
    setupCatalogueEventListeners();
}

// Load all catalogue items
function loadCatalogue() {
    fetch('../backend/api/catalogue/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayCatalogue(data.items);
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
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No items in catalogue</td></tr>';
        return;
    }
    
    let html = '';
    items.forEach(item => {
        const stock = parseInt(item.quantity_on_hand) || 0;
        const stockClass = stock === 0 ? 'out-of-stock' : (stock < 10 ? 'low-stock' : '');
        const stockWarning = stock < 10 && stock > 0 ? '<i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-left: 5px;"></i>' : '';
        
        html += `
            <tr>
                <td>${escapeHtml(item.isbn)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.author || 'N/A')}</td>
                <td>${escapeHtml(item.category || 'N/A')}</td>
                <td>$${parseFloat(item.unit_price).toFixed(2)}</td>
                <td class="${stockClass}">${stock}${stockWarning}</td>
                <td>
                    <button class="btn-icon" onclick="editItem(${item.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="showAdjustModal(${item.id}, ${stock}, '${escapeHtml(item.title)}')" title="Adjust Stock">
                        <i class="fas fa-arrows-alt-v"></i>
                    </button>
                    <button class="btn-icon" onclick="viewHistory(${item.id}, '${escapeHtml(item.title)}')" title="View History">
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
        searchInput.removeEventListener('keyup', filterCatalogue);
        searchInput.addEventListener('keyup', filterCatalogue);
    }
    
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
function editItem(bookId) {
    fetch('../backend/api/catalogue/list.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const item = data.items.find(i => i.id == bookId);
                if (item) {
                    document.getElementById('modalTitle').textContent = 'Edit Item';
                    document.getElementById('book_id').value = item.id;
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
                }
            }
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
function showAdjustModal(bookId, currentStock, title) {
    document.getElementById('adjust_book_id').value = bookId;
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
    const adjustmentType = document.getElementById('adjustment_type').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    const currentStock = parseInt(document.getElementById('current_quantity').value);
    let reason = document.getElementById('reason').value;
    
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
function viewHistory(bookId, title) {
    document.getElementById('history_book_title').textContent = title;
    document.getElementById('historyModal').style.display = 'block';
    
    fetch(`../backend/api/catalogue/get_history.php?book_id=${bookId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayHistory(data.history);
            } else {
                document.getElementById('historyList').innerHTML = 
                    '<p style="text-align: center; color: #ef4444;">Error loading history</p>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('historyList').innerHTML = 
                '<p style="text-align: center; color: #ef4444;">Failed to load history</p>';
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
