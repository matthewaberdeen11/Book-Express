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
    
    //get all catalogue items with inventory
    $stmt = $conn->prepare('
        SELECT 
            b.id,
            b.isbn,
            b.title,
            b.author,
            b.publisher,
            b.category,
            b.description,
            b.unit_price,
            COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
            i.reorder_level
        FROM books b
        LEFT JOIN inventory i ON b.id = i.book_id
        ORDER BY b.title ASC
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
