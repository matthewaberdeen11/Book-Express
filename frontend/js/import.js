// import.js
// Handles import page logic for initial and daily imports

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/Book-Express/frontend/login.html';
        return;
    }
    
    // Initialize user profile
    initializeUserProfile(user);
    
    // Set up sidebar toggle for mobile
    setupSidebarToggle();
    
    // Set up navigation
    setupNavigation();
    
    const initialBtn = document.getElementById('initialImportBtn');
    const dailyBtn = document.getElementById('dailyImportBtn');
    const guidelinesList = document.getElementById('guidelinesList');
    const templateBtn = document.getElementById('downloadTemplateBtn');
    const csvInput = document.getElementById('csvFileInput');
    const uploadLabel = document.querySelector('.upload-label');

    // Load import logs on page load
    loadImportLogs();

    // Default: initial import selected
    let importType = 'initial';
    setGuidelines(importType);
    document.getElementById('guidelinesInitial').style.display = 'block';

    initialBtn.addEventListener('click', function () {
        importType = 'initial';
        setGuidelines(importType);
        document.getElementById('guidelinesInitial').style.display = 'block';
        document.getElementById('guidelinesDaily').style.display = 'none';
        initialBtn.classList.add('active');
        dailyBtn.classList.remove('active');
    });
    dailyBtn.addEventListener('click', function () {
        importType = 'daily';
        setGuidelines(importType);
        document.getElementById('guidelinesInitial').style.display = 'none';
        document.getElementById('guidelinesDaily').style.display = 'block';
        dailyBtn.classList.add('active');
        initialBtn.classList.remove('active');
    });

    const uploadBox = document.querySelector('.upload-box');
    const importSummary = document.getElementById('importSummary');
    const importAlert = document.getElementById('importAlert');

    uploadLabel.addEventListener('click', function (e) {
        e.preventDefault();
        csvInput.click();
    });

    // Set up logout function
    const logoutLinks = document.querySelectorAll('.logout');
    logoutLinks.forEach(link => {
        link.addEventListener('click', logout);
    });

    // Drag and drop support
    uploadBox.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadBox.style.opacity = '0.7';
    });

    uploadBox.addEventListener('dragleave', function () {
        uploadBox.style.opacity = '1';
    });

    uploadBox.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadBox.style.opacity = '1';
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                uploadCSV(file);
            } else {
                alert('Please upload a CSV file');
            }
        }
    });

    templateBtn.addEventListener('click', function () {
        if (importType === 'initial') {
            // Download Item.csv template
            const link = document.createElement('a');
            link.href = '../assets/Item_sample.csv';
            link.download = 'Item.csv';
            link.click();
        } else {
            // Download Sales_by_Item.csv template
            const link = document.createElement('a');
            link.href = '../assets/Sales_by_Item_sample.csv';
            link.download = 'Sales_by_Item.csv';
            link.click();
        }
    });

    csvInput.addEventListener('change', function () {
        if (csvInput.files.length > 0) {
            uploadCSV(csvInput.files[0]);
        }
    });

    function uploadCSV(file) {
        const formData = new FormData();
        formData.append('csv', file);
        formData.append('importType', importType);

        fetch('../backend/api/import.php', {
            method: 'POST',
            body: formData
        })
            .then(async response => {
                if (!response.ok) {
                    throw new Error('HTTP error, status = ' + response.status);
                }
                const text = await response.text();
                try { return JSON.parse(text); } catch (e) { throw new Error(text || 'Invalid JSON response'); }
            })
            .then(data => {
                showSummary(data);
            })
            .catch(err => {
                console.error('Error:', err);
                importSummary.style.display = 'block';
                importSummary.innerHTML = `<h3>Import Failed</h3><p style="color: red;">Error: ${err.message}</p>`;
            });
    }

    function showSummary(data) {
        document.getElementById('importSummary').style.display = 'block';
        document.getElementById('processedCount').textContent = data.processed || 0;
        document.getElementById('successfulCount').textContent = data.successful || 0;
        document.getElementById('unrecognizedCount').textContent = data.unrecognized ? data.unrecognized.length : 0;
        document.getElementById('discrepanciesCount').textContent = data.discrepancies ? data.discrepancies.length : 0;
        document.getElementById('errorsCount').textContent = data.errors ? data.errors.length : 0;

        // Debug: Log full response to console
        console.log('Import Response:', data);

        // If there are errors, show them in the console for debugging
        if (data.errors && data.errors.length > 0) {
            console.error('Errors found:');
            data.errors.forEach((err, idx) => {
                console.error(`  Row ${idx}: ${err.error}`);
            });
        }

        // Show alert if discrepancies
        if (data.discrepancies && data.discrepancies.length > 0) {
            document.getElementById('importAlert').style.display = 'flex';
            document.getElementById('alertMessage').textContent = 'Average price mismatch detected. Import queued. Please review item details.';
        } else {
            document.getElementById('importAlert').style.display = 'none';
        }

        // Reload import logs
        loadImportLogs();
    }

    function setGuidelines(type) {
        guidelinesList.innerHTML = '';
        if (type === 'initial') {
            guidelinesList.innerHTML = `
                <li><strong>Header Row:</strong> Item ID, Item Name, Rate, Product Type, Status</li>
                <li><strong>Data Format:</strong> Use ZOHO export format with at least 24 columns</li>
                <li><strong>Item ID:</strong> Unique identifier (e.g., 7288706000000093261)</li>
                <li><strong>Rate:</strong> Format "JMD XXXX.XX" - numeric portion extracted automatically</li>
                <li><strong>Auto-Assign:</strong> Quantity automatically set to 0</li>
            `;
        } else {
            guidelinesList.innerHTML = `
                <li><strong>Header Row:</strong> item_id, item_name, quantity_sold, amount, average_price</li>
                <li><strong>Data Format:</strong> Use ZOHO sales export format</li>
                <li><strong>item_id:</strong> Must match an existing Item ID from initial import</li>
                <li><strong>Quantity Check:</strong> Never goes below 0 (capped at 0)</li>
                <li><strong>Price Check:</strong> average_price must be within ±10% of stored rate</li>
            `;
        }
    }

    function loadImportLogs() {
        fetch('../backend/api/dashboard.php?action=getImportLogs')
            .then(async response => { const text = await response.text(); try { return JSON.parse(text); } catch (e) { return []; } })
            .then(data => {
                const logsList = document.getElementById('importLogsList');
                if (data && Array.isArray(data) && data.length > 0) {
                    let html = '';
                    data.forEach(log => {
                        const statusClass = log.status === 'completed' ? 'completed' : 'completed-with-issues';
                        const statusIcon = log.status === 'completed' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
                        const importTypeLabel = log.import_type === 'initial' ? 'Initial Inventory' : 'Daily Sales';
                        const importTypeIcon = log.import_type === 'initial' ? '<i class="fas fa-box"></i>' : '<i class="fas fa-receipt"></i>';
                        
                        // Format date and time
                        const uploadDate = new Date(log.uploaded_at);
                        const formattedDateTime = uploadDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                        }) + ' at ' + uploadDate.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        const userName = log.user_name || 'Unknown User';
                        const successCount = log.rows_processed - log.rows_failed;
                        
                        html += `
                            <div class="log-item ${statusClass}">
                                <div class="log-icon">${statusIcon}</div>
                                <div class="log-details">
                                    <p class="log-file">${log.file_name}</p>
                                    <div class="log-meta">
                                        <span class="log-type">${importTypeIcon} ${importTypeLabel}</span>
                                        <span class="log-user"><i class="fas fa-user"></i> ${userName}</span>
                                        <span class="log-datetime"><i class="fas fa-calendar"></i> ${formattedDateTime}</span>
                                    </div>
                                </div>
                                <div class="log-results">
                                    <div class="result-item success">
                                        <span class="result-icon"><i class="fas fa-check"></i></span>
                                        <span class="result-label">Successful</span>
                                        <span class="result-value">${successCount}</span>
                                    </div>
                                    <div class="result-item failed">
                                        <span class="result-icon"><i class="fas fa-times"></i></span>
                                        <span class="result-label">Failed</span>
                                        <span class="result-value">${log.rows_failed}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    logsList.innerHTML = html;
                } else {
                    logsList.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;"><i class="fas fa-inbox"></i> No imports yet. Upload a CSV file to see import history.</p>';
                }
            })
            .catch(err => {
                console.error('Error loading import logs:', err);
                document.getElementById('importLogsList').innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;"><i class="fas fa-exclamation-triangle"></i> Unable to load import history.</p>';
            });
    }
});

// ==================== USER PROFILE INITIALIZATION ====================
function initializeUserProfile(user) {
    const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
    
    // Update user profile display
    document.getElementById('userInitial').textContent = firstLetter;
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = role;
}

// ==================== SIDEBAR TOGGLE ====================
function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (!toggle) return;
    
    toggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        container.classList.toggle('sidebar-open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.sidebar-toggle')) {
            closeSidebarMobile();
        }
    });
    
    // Handle window resize - ensure sidebar is visible on large screens
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('collapsed');
            container.classList.remove('sidebar-open');
        }
    });
}

function closeSidebarMobile() {
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    // Only close on mobile screens
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Skip default behavior for logout
            if (this.classList.contains('logout')) {
                return;
            }
            // For navigation, go to the href page
            if (this.getAttribute('href')) {
                window.location.href = this.getAttribute('href');
            }
            // Close sidebar on mobile after selection
            closeSidebarMobile();
        });
    });
}

async function logout() {
    try {
        const response = await fetch('/Book-Express/backend/api/logout.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Redirect to login page
            window.location.href = '/Book-Express/frontend/login.html';
        } else {
            console.error('Logout failed:', data.error);
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during logout:', error);
        alert('An error occurred during logout. Please try again.');
    }
}
