// ==================== CATALOGUE MANAGEMENT ====================

// Global catalogue data
let catalogueData = {
    items: [],
    allItems: [],
    currentEditingItem: null
};

let topSellersChart = null;
let gradeChart = null;

// Initialize catalogue page
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadCatalogue();
    setupEventListeners();
    setupSidebarToggle();
});

// Load catalogue from API
function loadCatalogue() {
    fetch('../backend/api/catalogue/list.php')
        .then(async response => { const text = await response.text(); try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; } })
        .then(data => {
            if (data.success) {
                catalogueData.allItems = data.items || [];
                catalogueData.items = [...catalogueData.allItems];
                displayCatalogue(catalogueData.items);
            } else {
                console.error('Error loading catalogue:', data.error);
                showErrorMessage('Failed to load catalogue');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorMessage('Failed to load catalogue');
        });
}

// Display catalogue items in table
function displayCatalogue(items) {
    const tbody = document.getElementById('catalogueBody');
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        const itemTitle = item.item_name || item.title;
        const itemId = item.item_id;
        const gradeLevel = item.grade_level || 'N/A';
        const stock = item.quantity_on_hand || 0;
        let price = 0;
        
        if (item.rate) {
            if (typeof item.rate === 'string') {
                const match = item.rate.match(/([\d,.]+)/);
                price = match ? parseFloat(match[1].replace(/,/g, '')) : 0;
            } else {
                price = parseFloat(item.rate);
            }
        }
        
        return `
            <tr>
                <td>${escapeHtml(itemId)}</td>
                <td class="item-title" style="cursor: pointer; color: var(--primary-color);">
                    ${escapeHtml(itemTitle)}
                </td>
                <td>${escapeHtml(gradeLevel)}</td>
                <td>${price.toFixed(2)}</td>
                <td>${stock}</td>
                <td>CSV Import</td>
                <td style="width: 300px;">
                    <button class="btn-edit" data-item-id="${itemId}" type="button"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn-adjust" data-item-id="${itemId}" data-title="${escapeHtml(itemTitle)}" type="button"><i class="fas fa-plus-minus"></i> Stock</button>
                    <button class="btn-history" data-item-id="${itemId}" data-title="${escapeHtml(itemTitle)}" type="button"><i class="fas fa-history"></i> History</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('catalogueSearch');
    const gradeFilter = document.getElementById('gradeFilter');
    
    searchInput.addEventListener('input', filterCatalogue);
    gradeFilter.addEventListener('change', filterCatalogue);
    
    // Character counter for adjustment notes
    document.getElementById('adjustmentNotes').addEventListener('input', function() {
        document.getElementById('charCount').textContent = this.value.length + ' / 500 characters';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const modals = ['itemModal', 'priceHistoryModal', 'adjustStockModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (event.target === modal) {
                closeModal(modalId);
            }
        });
    });
    
    // Event delegation for buttons
    document.addEventListener('click', function(event) {
        const editBtn = event.target.closest('.btn-edit');
        if (editBtn) {
            const itemId = editBtn.dataset.itemId;
            showEditModal(itemId);
            return;
        }
        
        const adjustBtn = event.target.closest('.btn-adjust');
        if (adjustBtn) {
            const itemId = adjustBtn.dataset.itemId;
            const title = adjustBtn.dataset.title;
            showAdjustStockModal(itemId, title);
            return;
        }
        
        const historyBtn = event.target.closest('.btn-history');
        if (historyBtn) {
            const itemId = historyBtn.dataset.itemId;
            const title = historyBtn.dataset.title;
            showPriceHistory(itemId, title);
            return;
        }
    });
}

// Filter catalogue by search and grade
function filterCatalogue() {
    const searchInput = document.getElementById('catalogueSearch').value.toLowerCase().trim();
    const gradeFilter = document.getElementById('gradeFilter').value;
    
    catalogueData.items = catalogueData.allItems.filter(item => {
        const title = (item.item_name || item.title || '').toLowerCase();
        const itemId = (item.book_id || item.item_id || '').toString().toLowerCase();
        const grade = item.grade_level || '';
        
        const matchesSearch = searchInput === '' || title.includes(searchInput) || itemId.includes(searchInput);
        const matchesGrade = !gradeFilter || grade.toLowerCase().includes(gradeFilter.toLowerCase());
        
        return matchesSearch && matchesGrade;
    });
    
    displayCatalogue(catalogueData.items);
}

// Show create item modal
function showCreateModal() {
    catalogueData.currentEditingItem = null;
    document.getElementById('modalTitle').textContent = 'Add New Item';
    document.getElementById('itemId').value = '';
    document.getElementById('itemId').disabled = false;
    document.getElementById('itemIdHint').textContent = '(Auto-generated if left blank)';
    document.getElementById('itemName').value = '';
    document.getElementById('gradeLevel').value = '';
    document.getElementById('unitPrice').value = '';
    document.getElementById('priceHistorySection').style.display = 'none';
    document.getElementById('itemModal').style.display = 'block';
}

// Show edit modal
function showEditModal(itemId) {
    // Find the item by item_id
    const item = catalogueData.allItems.find(i => String(i.item_id) === String(itemId));
    
    if (!item) {
        showErrorMessage('Item not found');
        return;
    }
    
    catalogueData.currentEditingItem = { itemId };
    
    const itemTitle = item.item_name || item.title;
    let price = 0;
    if (item.rate) {
        if (typeof item.rate === 'string') {
            const match = item.rate.match(/([\d,.]+)/);
            price = match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        } else {
            price = parseFloat(item.rate);
        }
    }
    
    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('itemId').value = itemId;
    document.getElementById('itemId').disabled = true;
    document.getElementById('itemIdHint').textContent = '';
    document.getElementById('itemName').value = itemTitle;
    document.getElementById('gradeLevel').value = item.grade_level || '';
    document.getElementById('unitPrice').value = price;
    
    // Show price history
    document.getElementById('priceHistorySection').style.display = 'block';
    document.getElementById('previousPrice').textContent = price.toFixed(2);
    
    document.getElementById('itemModal').style.display = 'block';
}

// Save item (create or update)
function saveItem(event) {
    event.preventDefault();
    
    const itemId = document.getElementById('itemId').value.trim();
    const itemName = document.getElementById('itemName').value.trim();
    const gradeLevel = document.getElementById('gradeLevel').value;
    const unitPrice = parseFloat(document.getElementById('unitPrice').value);
    
    if (!itemName || !gradeLevel || !unitPrice) {
        showErrorMessage('Please fill in all required fields');
        return;
    }
    
    const isEdit = catalogueData.currentEditingItem !== null;
    const endpoint = isEdit ? '../backend/api/catalogue/update_item.php' : '../backend/api/catalogue/create_item.php';
    
    const formData = {
        item_name: itemName,
        grade_level: gradeLevel,
        rate: unitPrice
    };
    
    if (isEdit) {
        formData.item_id = catalogueData.currentEditingItem.itemId;
    } else {
        if (itemId) {
            formData.item_id = itemId;
        }
    }
    
    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
        .then(async response => { const text = await response.text(); try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; } })
        .then(data => {
            if (data.success) {
                showSuccessMessage(isEdit ? 'Item updated successfully' : 'Item created successfully');
                closeModal('itemModal');
                loadCatalogue();
            } else {
                showErrorMessage(data.error || 'Failed to save item');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorMessage('Failed to save item');
        });
}

// Show adjust stock modal
function showAdjustStockModal(itemId, itemTitle) {
    // Find the item by item_id
    const item = catalogueData.allItems.find(i => String(i.item_id) === String(itemId));
    
    if (!item) {
        showErrorMessage('Item not found');
        return;
    }
    
    catalogueData.currentEditingItem = { itemId };
    
    document.getElementById('adjustItemTitle').textContent = itemTitle;
    document.getElementById('currentStock').textContent = item.quantity_on_hand || 0;
    document.getElementById('adjustmentValue').value = '';
    document.getElementById('adjustmentReason').value = '';
    document.getElementById('adjustmentNotes').value = '';
    document.getElementById('charCount').textContent = '0 / 500 characters';
    
    document.getElementById('adjustStockModal').style.display = 'block';
}

// Submit stock adjustment
function submitStockAdjustment(event) {
    event.preventDefault();
    
    const adjustmentValueInput = document.getElementById('adjustmentValue').value.trim();
    const adjustmentReason = document.getElementById('adjustmentReason').value;
    const adjustmentNotes = document.getElementById('adjustmentNotes').value.trim();
    
    if (!adjustmentValueInput || !adjustmentReason) {
        showErrorMessage('Please fill in all required fields');
        return;
    }
    
    const adjustmentValue = parseInt(adjustmentValueInput);
    if (isNaN(adjustmentValue)) {
        showErrorMessage('Adjustment value must be a valid number');
        return;
    }
    
    const formData = {
        item_id: catalogueData.currentEditingItem.itemId,
        adjustment_amount: adjustmentValue,
        reason: adjustmentReason,
        notes: adjustmentNotes
    };
    
    fetch('../backend/api/catalogue/adjust_stock.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
        .then(async response => { const text = await response.text(); try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; } })
        .then(data => {
            if (data.success) {
                showSuccessMessage('Stock adjusted successfully');
                closeModal('adjustStockModal');
                loadCatalogue();
            } else {
                showErrorMessage(data.error || 'Failed to adjust stock');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrorMessage('Failed to adjust stock');
        });
}

// Show price history modal
function showPriceHistory(itemId, itemTitle) {
    document.getElementById('priceHistoryItemTitle').textContent = itemTitle;
    
    const params = `item_id=${itemId}`;
    
    fetch(`../backend/api/catalogue/get_history.php?${params}`)
        .then(async response => {
            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } catch (e) { 
                console.error('Parse error:', e, 'Response text:', text);
                data = { success: false, history: [], error: text }; 
            }
            
            const tbody = document.getElementById('priceHistoryBody');
            
            if (data.success && data.history && data.history.length > 0) {
                // Filter and render only price history entries (PRICE_UPDATE action_type or type='price')
                const priceEntries = data.history.filter(entry => 
                    entry.action_type === 'PRICE_UPDATE' || entry.type === 'price'
                );
                
                if (priceEntries.length > 0) {
                    tbody.innerHTML = priceEntries.map(entry => {
                        const oldPrice = parseFloat(entry.old_value ?? entry.old_price).toFixed(2);
                        const newPrice = parseFloat(entry.new_value ?? entry.new_price).toFixed(2);
                        const timestamp = entry.created_at ?? entry.changed_at;
                        
                        return `
                            <tr>
                                <td><strong>Price Change</strong></td>
                                <td>JMD ${oldPrice} → ${newPrice}</td>
                                <td>${new Date(timestamp).toLocaleDateString()}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">No price history found</td></tr>';
                }
            } else {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">No history found</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error loading history:', error);
            document.getElementById('priceHistoryBody').innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: red;">Error loading history</td></tr>';
        });
    
    document.getElementById('priceHistoryModal').style.display = 'block';
}

// Show item detail (currently used for viewing)
function showItemDetail(source, itemId, title) {
    // This can be expanded for detailed item view if needed
    console.log('Item details for:', title);
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Sidebar toggle for mobile
function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (toggle) {
        toggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            container.classList.toggle('sidebar-open');
        });
    }
    
    // Close sidebar on mobile when clicking a link
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', closeSidebarMobile);
    });
}

function closeSidebarMobile() {
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        const container = document.querySelector('.dashboard-container');
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/Book-Express/backend/api/user.php');
        const data = await response.json();
        
        if (!data.success || !data.user) {
            window.location.href = '/Book-Express/frontend/login.html';
            return null;
        }
        
        // Update user profile
        const firstLetter = data.user.username ? data.user.username.charAt(0).toUpperCase() : 'U';
        const role = data.user.role ? data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1) : 'User';
        
        document.getElementById('userInitial').textContent = firstLetter;
        document.getElementById('userName').textContent = data.user.username;
        document.getElementById('userRole').textContent = role;
        
        return data.user;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/Book-Express/frontend/login.html';
        return null;
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/Book-Express/backend/api/logout.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/Book-Express/frontend/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
        alert('Logout failed. Please try again.');
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showErrorMessage(message) {
    alert('Error: ' + message);
}

function showSuccessMessage(message) {
    // Could be replaced with a toast notification
    console.log('Success:', message);
    alert('Success: ' + message);
}
