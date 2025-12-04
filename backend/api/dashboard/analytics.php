<?php
// Analytics dashboard API
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    $conn = get_db_connection();
    $metric = $_GET['metric'] ?? 'all';
    
    $data = [];
    
    // 0. Overview Metrics - for dashboard
    if ($metric === 'all' || $metric === 'overview') {
        $stmt = $conn->prepare('
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN COALESCE(quantity_on_hand, 0) > 0 THEN 1 ELSE 0 END) as in_stock,
                SUM(CASE WHEN COALESCE(quantity_on_hand, 0) = 0 THEN 1 ELSE 0 END) as out_of_stock,
                SUM(COALESCE(quantity_on_hand, 0) * CAST(REPLACE(REPLACE(COALESCE(rate, "0"), "JMD ", ""), ",", "") AS DECIMAL(10,2))) as total_value
            FROM inventory
        ');
        $stmt->execute();
        $overview = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Get low stock alerts count
        $stmt = $conn->prepare('
            SELECT COUNT(*) as count FROM low_stock_alerts WHERE status = "active"
        ');
        $stmt->execute();
        $alertCount = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $data['overview'] = [
            'total_items' => $overview['total_items'] ?? 0,
            'in_stock' => $overview['in_stock'] ?? 0,
            'out_of_stock' => $overview['out_of_stock'] ?? 0,
            'low_stock_alerts' => $alertCount['count'] ?? 0,
            'total_value' => $overview['total_value'] ?? 0
        ];
    }
    
    // 1. Top Sellers - Top 5 items with most cumulative quantity_sold
    if ($metric === 'all' || $metric === 'top_sellers') {
        $stmt = $conn->prepare('
            SELECT 
                i.item_id,
                i.item_name,
                i.grade_level,
                COALESCE(i.quantity_sold, 0) as quantity_sold,
                i.rate as price
            FROM inventory i
            WHERE COALESCE(i.quantity_sold, 0) > 0
            ORDER BY i.quantity_sold DESC
            LIMIT 5
        ');
        $stmt->execute();
        $data['top_sellers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // 2. Stock Level by Grade Level - shows inventory quantity per grade
    if ($metric === 'all' || $metric === 'stock_by_grade') {
        $stmt = $conn->prepare('
            SELECT 
                COALESCE(i.grade_level, "Ungraded") as grade_level,
                COUNT(*) as item_count,
                SUM(COALESCE(i.quantity_on_hand, 0)) as total_quantity,
                SUM(COALESCE(i.quantity_on_hand, 0) * CAST(REPLACE(REPLACE(COALESCE(i.rate, "0"), "JMD ", ""), ",", "") AS DECIMAL(10,2))) as total_value
            FROM inventory i
            GROUP BY i.grade_level
            ORDER BY total_quantity DESC
        ');
        $stmt->execute();
        $data['stock_by_grade'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // 3. Stock Status Pie Chart - Out of Stock, Low in Stock, In Stock
    if ($metric === 'all' || $metric === 'stock_status') {
        $stmt = $conn->prepare('
            SELECT 
                CASE 
                    WHEN COALESCE(i.quantity_on_hand, 0) = 0 THEN "Out of Stock"
                    WHEN COALESCE(i.quantity_on_hand, 0) > 0 AND COALESCE(i.quantity_on_hand, 0) <= COALESCE(i.reorder_level, 10) THEN "Low in Stock"
                    ELSE "In Stock"
                END as status,
                COUNT(*) as count
            FROM inventory i
            GROUP BY status
        ');
        $stmt->execute();
        $stockStatus = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format for chart
        $data['stock_status'] = [
            'out_of_stock' => 0,
            'low_in_stock' => 0,
            'in_stock' => 0
        ];
        
        foreach ($stockStatus as $status) {
            if ($status['status'] === 'Out of Stock') {
                $data['stock_status']['out_of_stock'] = $status['count'];
            } elseif ($status['status'] === 'Low in Stock') {
                $data['stock_status']['low_in_stock'] = $status['count'];
            } elseif ($status['status'] === 'In Stock') {
                $data['stock_status']['in_stock'] = $status['count'];
            }
        }
    }
    
    // 4. Amount Sold by Grade Level - cumulative quantity_sold grouped by grade
    if ($metric === 'all' || $metric === 'sales_by_grade') {
        $stmt = $conn->prepare('
            SELECT 
                COALESCE(i.grade_level, "Ungraded") as grade_level,
                SUM(COALESCE(i.quantity_sold, 0)) as total_quantity_sold,
                COUNT(CASE WHEN COALESCE(i.quantity_sold, 0) > 0 THEN 1 END) as items_with_sales
            FROM inventory i
            GROUP BY i.grade_level
            HAVING SUM(COALESCE(i.quantity_sold, 0)) > 0
            ORDER BY total_quantity_sold DESC
        ');
        $stmt->execute();
        $data['sales_by_grade'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    echo json_encode([
        'success' => true,
        'data' => $data
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

