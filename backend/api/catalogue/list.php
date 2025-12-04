<?php
//list all catalogue items with inventory
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
    
    //get manually added items (from books table)
    $stmt = $conn->prepare('
        SELECT 
            b.id as book_id,
            NULL as item_id,
            b.isbn,
            b.title,
            b.author,
            b.publisher,
            b.category,
            b.description,
            b.unit_price,
            COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
            i.reorder_level,
            "manual" as source
        FROM books b
        LEFT JOIN inventory i ON b.id = i.book_id
        WHERE i.book_id IS NOT NULL
        
        UNION ALL
        
        -- get CSV imported items (from inventory table only)
        SELECT 
            NULL as book_id,
            i.item_id,
            i.item_id as isbn,
            i.item_name as title,
            \'\' as author,
            \'\' as publisher,
            CASE 
                WHEN i.item_name LIKE \'%Mathematics%\' OR i.item_name LIKE \'%Redicovery%\' THEN \'Mathematics\'
                WHEN i.item_name LIKE \'%Phonics%\' THEN \'Language Arts\'
                WHEN i.item_name LIKE \'%Island Jamaica%\' OR i.item_name LIKE \'%Learn Together%\' THEN \'Social Studies\'
                ELSE \'General\'
            END as category,
            \'\' as description,
            CAST(i.rate AS DECIMAL(10, 2)) as unit_price,
            COALESCE(i.quantity, 0) as quantity_on_hand,
            0 as reorder_level,
            \'csv\' as source
        FROM inventory i
        WHERE i.book_id IS NULL AND i.item_id IS NOT NULL
        
        ORDER BY title ASC
    ');
    
    $stmt->execute();
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'items' => $items
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
