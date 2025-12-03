<?php
// dashboard.php - API endpoint to retrieve dashboard data
header('Content-Type: application/json');

set_error_handler(function($errno, $errstr) {
    http_response_code(500);
    echo json_encode(['error' => $errstr]);
    exit;
});

try {
    require_once '../config/database.php';
    
    $conn = get_db_connection();
    $action = $_GET['action'] ?? 'getDashboard';
    
    if ($action === 'getImportLogs') {
        // Get recent import logs with user info (up to 10)
        $stmt = $conn->prepare('
            SELECT 
                il.id, 
                il.user_id, 
                u.username as user_name,
                il.file_name, 
                il.import_type, 
                il.status, 
                il.rows_processed, 
                il.rows_failed, 
                il.uploaded_at, 
                il.completed_at 
            FROM import_logs il
            LEFT JOIN users u ON il.user_id = u.id
            ORDER BY il.uploaded_at DESC 
            LIMIT 10
        ');
        $stmt->execute();
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($logs);
        return;
    }
    
    // Default: getDashboard
    // Get total items from enhanced_inventory
    $stmt = $conn->prepare('SELECT COUNT(*) as total FROM enhanced_inventory WHERE is_active = 1');
    $stmt->execute();
    $totalResult = $stmt->fetch();
    $totalItems = $totalResult['total'] ?? 0;
    
    // Get in stock vs out of stock
    $stmt = $conn->prepare('SELECT 
        SUM(CASE WHEN current_stock > 0 THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock
        FROM enhanced_inventory WHERE is_active = 1');
    $stmt->execute();
    $stockResult = $stmt->fetch();
    $inStock = $stockResult['in_stock'] ?? 0;
    $outOfStock = $stockResult['out_of_stock'] ?? 0;
    
    // Get low stock alerts (current_stock < minimum_stock)
    $stmt = $conn->prepare('SELECT COUNT(*) as low_stock FROM enhanced_inventory WHERE is_active = 1 AND current_stock > 0 AND current_stock < minimum_stock');
    $stmt->execute();
    $lowStockResult = $stmt->fetch();
    $lowStockCount = $lowStockResult['low_stock'] ?? 0;
    
    // Get total inventory value (selling_price * current_stock for all items with stock > 0)
    $stmt = $conn->prepare('
        SELECT SUM(selling_price * current_stock) as total_value 
        FROM enhanced_inventory 
        WHERE is_active = 1 AND current_stock > 0
    ');
    $stmt->execute();
    $valueResult = $stmt->fetch();
    $totalValue = floatval($valueResult['total_value'] ?? 0);
    
    echo json_encode([
        'totalItems' => (int)$totalItems,
        'inStock' => (int)$inStock,
        'outOfStock' => (int)$outOfStock,
        'lowStockCount' => (int)$lowStockCount,
        'inventoryValue' => $totalValue
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    error_log('Dashboard error: ' . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
}
?>
