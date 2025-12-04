<?php
// analytics.php - Book Express Analytics API
// Location: backend/api/analytics.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Include database connection
require_once '../config/database.php';

try {
    // Get database connection
    $pdo = get_db_connection();
    
    // Get parameters
    $action = $_GET['action'] ?? '';
    $period = isset($_GET['period']) ? (int)$_GET['period'] : 30;
    
    if ($action !== 'analytics') {
        throw new Exception('Invalid action');
    }
    
    // Calculate date range
    $endDate = date('Y-m-d');
    $startDate = date('Y-m-d', strtotime("-{$period} days"));

    // Simple file cache to reduce repeated heavy queries (TTL seconds)
    $cacheTtl = 30; // seconds
    $cacheDir = __DIR__ . '/../cache';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    $cacheFile = $cacheDir . "/analytics_{$period}.json";
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTtl)) {
        // Serve cached response
        header('X-Cache: HIT');
        readfile($cacheFile);
        exit;
    }
    
    // Initialize response
    $response = [
        'totalItems' => 0,
        'totalValue' => 0,
        'inStock' => 0,
        'outOfStock' => 0,
        'lowStockAlerts' => 0,
        'topSellers' => [],
        'gradeSales' => [],
        'subjectSales' => [],
        'slowMoving' => []
    ];
    
    // 1. Get summary metrics
    $stmt = $pdo->query("
        SELECT 
            COUNT(DISTINCT b.id) as total_items,
            SUM(b.unit_price * COALESCE(i.quantity_on_hand, 0)) as total_value,
            SUM(CASE WHEN i.quantity_on_hand > 0 THEN 1 ELSE 0 END) as in_stock,
            SUM(CASE WHEN i.quantity_on_hand = 0 THEN 1 ELSE 0 END) as out_of_stock,
            SUM(CASE WHEN i.quantity_on_hand <= i.reorder_level AND i.quantity_on_hand > 0 THEN 1 ELSE 0 END) as low_stock
        FROM books b
        LEFT JOIN inventory i ON b.id = i.book_id
    ");
    $metrics = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $response['totalItems'] = (int)$metrics['total_items'];
    $response['totalValue'] = number_format((float)$metrics['total_value'], 2, '.', '');
    $response['inStock'] = (int)$metrics['in_stock'];
    $response['outOfStock'] = (int)$metrics['out_of_stock'];
    $response['lowStockAlerts'] = (int)$metrics['low_stock'];
    
    // 2. Get top 10 sellers
    $stmt = $pdo->prepare("
        SELECT 
            b.title,
            SUM(s.quantity_sold) as total_sold
        FROM sales s
        JOIN books b ON s.book_id = b.id
        WHERE s.sale_date >= ? AND s.sale_date <= ?
        GROUP BY b.id, b.title
        ORDER BY total_sold DESC
        LIMIT 10
    ");
    $stmt->execute([$startDate, $endDate]);
    $topSellers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $labels = [];
    $data = [];
    foreach ($topSellers as $seller) {
        $labels[] = $seller['title'];
        $data[] = (int)$seller['total_sold'];
    }
    
    $response['topSellers'] = [
        'labels' => $labels,
        'datasets' => [[
            'label' => 'Quantity Sold',
            'data' => $data,
            'backgroundColor' => 'rgba(28, 200, 138, 0.8)',
            'borderColor' => 'rgba(28, 200, 138, 1)',
            'borderWidth' => 1
        ]]
    ];
    
    // 3. Sales by Grade Level (extract from title)
    $stmt = $pdo->prepare("
        SELECT 
            b.title,
            SUM(s.quantity_sold) as total_sold
        FROM sales s
        JOIN books b ON s.book_id = b.id
        WHERE s.sale_date >= ? AND s.sale_date <= ?
        GROUP BY b.id, b.title
    ");
    $stmt->execute([$startDate, $endDate]);
    $allSales = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $gradeSales = [
        'Pre-K/Infant' => 0,
        'K1-K3' => 0,
        'Grade 1-3' => 0,
        'Grade 4-6' => 0,
        'Grade 7-9' => 0,
        'Grade 10-13' => 0,
        'Other' => 0
    ];
    
    foreach ($allSales as $sale) {
        $title = strtolower($sale['title']);
        $qty = (int)$sale['total_sold'];
        
        if (preg_match('/\b(pre-?k|infant)\b/i', $title)) {
            $gradeSales['Pre-K/Infant'] += $qty;
        } elseif (preg_match('/\bk[1-3]\b/i', $title)) {
            $gradeSales['K1-K3'] += $qty;
        } elseif (preg_match('/\bgrade\s*[1-3]\b/i', $title)) {
            $gradeSales['Grade 1-3'] += $qty;
        } elseif (preg_match('/\bgrade\s*[4-6]\b/i', $title)) {
            $gradeSales['Grade 4-6'] += $qty;
        } elseif (preg_match('/\bgrade\s*[7-9]\b/i', $title)) {
            $gradeSales['Grade 7-9'] += $qty;
        } elseif (preg_match('/\bgrade\s*1[0-3]\b/i', $title)) {
            $gradeSales['Grade 10-13'] += $qty;
        } else {
            $gradeSales['Other'] += $qty;
        }
    }
    
    // Remove empty categories
    $gradeSales = array_filter($gradeSales, function($val) { return $val > 0; });
    
    $response['gradeSales'] = [
        'labels' => array_keys($gradeSales),
        'datasets' => [[
            'label' => 'Quantity Sold by Grade',
            'data' => array_values($gradeSales),
            'backgroundColor' => 'rgba(54, 162, 235, 0.8)',
            'borderColor' => 'rgba(54, 162, 235, 1)',
            'borderWidth' => 1
        ]]
    ];
    
    // 4. Sales by Subject (extract from title or category)
    $subjectSales = [
        'Mathematics' => 0,
        'Science' => 0,
        'English/Literature' => 0,
        'Reading/Phonics' => 0,
        'Social Studies' => 0,
        'Workbooks' => 0,
        'Other' => 0
    ];
    
    foreach ($allSales as $sale) {
        $title = strtolower($sale['title']);
        $qty = (int)$sale['total_sold'];
        
        if (preg_match('/\b(math|arithmetic|algebra|geometry)\b/i', $title)) {
            $subjectSales['Mathematics'] += $qty;
        } elseif (preg_match('/\b(science|biology|chemistry|physics)\b/i', $title)) {
            $subjectSales['Science'] += $qty;
        } elseif (preg_match('/\b(english|literature|grammar|writing)\b/i', $title)) {
            $subjectSales['English/Literature'] += $qty;
        } elseif (preg_match('/\b(reading|phonics|comprehension)\b/i', $title)) {
            $subjectSales['Reading/Phonics'] += $qty;
        } elseif (preg_match('/\b(social studies|history|geography)\b/i', $title)) {
            $subjectSales['Social Studies'] += $qty;
        } elseif (preg_match('/\b(workbook|exercise)\b/i', $title)) {
            $subjectSales['Workbooks'] += $qty;
        } else {
            $subjectSales['Other'] += $qty;
        }
    }
    
    // Remove empty categories
    $subjectSales = array_filter($subjectSales, function($val) { return $val > 0; });
    
    $response['subjectSales'] = [
        'labels' => array_keys($subjectSales),
        'datasets' => [[
            'label' => 'Quantity Sold by Subject',
            'data' => array_values($subjectSales),
            'backgroundColor' => 'rgba(255, 159, 64, 0.8)',
            'borderColor' => 'rgba(255, 159, 64, 1)',
            'borderWidth' => 1
        ]]
    ];
    
    // 5. Slow-moving inventory (no sales in 90 days, stock > 0)
    $ninetyDaysAgo = date('Y-m-d', strtotime('-90 days'));
    
    $stmt = $pdo->prepare("
        SELECT 
            b.id,
            b.title,
            i.quantity_on_hand as quantity
        FROM books b
        JOIN inventory i ON b.id = i.book_id
        WHERE i.quantity_on_hand > 0
        AND b.id NOT IN (
            SELECT DISTINCT book_id 
            FROM sales 
            WHERE sale_date >= ?
        )
        ORDER BY i.quantity_on_hand DESC
        LIMIT 20
    ");
    $stmt->execute([$ninetyDaysAgo]);
    $slowMoving = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $response['slowMoving'] = array_map(function($item) {
        return [
            'title' => $item['title'],
            'quantity' => (int)$item['quantity']
        ];
    }, $slowMoving);
    
    echo json_encode($response);
    // write cache
    if (is_dir($cacheDir)) {
        @file_put_contents($cacheFile, json_encode($response));
    }
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database error',
        'message' => $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Request error',
        'message' => $e->getMessage()
    ]);

}

?>