<?php
//list all catalogue items with inventory
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';
require_once __DIR__ . '/../../utils/GradeExtractor.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    $conn = get_db_connection();
    
    // Get all inventory items
    $stmt = $conn->prepare('
        SELECT 
            i.item_id,
            i.item_name as title,
            i.rate,
            COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
            COALESCE(i.quantity_on_hand, 0) as quantity,
            COALESCE(i.reorder_level, 0) as reorder_level,
            COALESCE(i.grade_level, "") as grade_level,
            COALESCE(f.id IS NOT NULL, 0) as is_favourite,
            i.product_type as category
        FROM inventory i
        LEFT JOIN favourites f ON i.item_id = f.item_id
        ORDER BY i.item_name ASC
    ');
    
    $stmt->execute();
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Parse and format items
    foreach ($items as &$item) {
        // Parse rate (remove "JMD" prefix if present)
        $parsed_rate = preg_replace('/[^\d.]/', '', $item['rate']);
        $item['rate'] = is_numeric($parsed_rate) ? round((float)$parsed_rate, 2) : 0.00;
        
        // Extract grade level if missing
        if (empty($item['grade_level']) && !empty($item['title'])) {
            $item['grade_level'] = GradeExtractor::extractGrade($item['title']) ?? '';
        }
    }
    
    echo json_encode([
        'success' => true,
        'items' => $items
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
