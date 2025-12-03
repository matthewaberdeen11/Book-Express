<?php
//search catalogue items with real-time inventory
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
    
    // Get search parameters
    $query = $_GET['q'] ?? '';
    $search_type = $_GET['type'] ?? 'all'; // all, item_id, title, grade_level, category
    $limit = intval($_GET['limit'] ?? 20);
    $offset = intval($_GET['offset'] ?? 0);
    
    if (empty($query)) {
        echo json_encode([
            'success' => true,
            'items' => [],
            'total' => 0
        ]);
        exit;
    }
    
    // Build base query for both manual and CSV items
    $base_query = '
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
            NULL as grade_level,
            "manual" as source
        FROM books b
        LEFT JOIN inventory i ON b.id = i.book_id
        WHERE i.book_id IS NOT NULL
        
        UNION ALL
        
        SELECT 
            NULL as book_id,
            i.item_id,
            NULL as isbn,
            i.item_name as title,
            NULL as author,
            NULL as publisher,
            i.product_type as category,
            NULL as description,
            i.rate as unit_price,
            COALESCE(i.quantity, 0) as quantity_on_hand,
            NULL as grade_level,
            "csv" as source
        FROM inventory i
        WHERE i.book_id IS NULL AND i.item_id IS NOT NULL
    ';
    
    // Build WHERE clause based on search type
    $where_clauses = [];
    $params = [];
    
    switch ($search_type) {
        case 'item_id':
            // Exact match for item_id or ISBN
            $where_clauses[] = "(b.isbn LIKE ? OR i.item_id = ?)";
            $params[] = "%$query%";
            $params[] = $query;
            break;
            
        case 'title':
            // Partial/fuzzy match for title
            $where_clauses[] = "(b.title LIKE ? OR i.item_name LIKE ?)";
            $search_pattern = "%$query%";
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            break;
            
        case 'grade_level':
            // Grade level search (extract grade from title if available)
            $where_clauses[] = "(b.title LIKE ? OR i.item_name LIKE ?)";
            $search_pattern = "%$query%";
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            break;
            
        case 'category':
            // Category/Subject search
            $where_clauses[] = "(b.category LIKE ? OR i.product_type LIKE ?)";
            $search_pattern = "%$query%";
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            break;
            
        case 'all':
        default:
            // Search across all fields
            $search_pattern = "%$query%";
            $where_clauses[] = "(b.isbn LIKE ? OR b.title LIKE ? OR b.author LIKE ? OR b.category LIKE ? 
                                OR i.item_id = ? OR i.item_name LIKE ? OR i.product_type LIKE ?)";
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            $params[] = $query;
            $params[] = $search_pattern;
            $params[] = $search_pattern;
            break;
    }
    
    // Combine with base query
    $where_clause = '';
    if (!empty($where_clauses)) {
        $where_clause = ' WHERE ' . implode(' OR ', $where_clauses);
    }
    
    // Get total count
    $count_sql = "SELECT COUNT(*) as total FROM ($base_query) as search_results $where_clause";
    $stmt = $conn->prepare($count_sql);
    $stmt->execute($params);
    $count_result = $stmt->fetch(PDO::FETCH_ASSOC);
    $total = $count_result['total'] ?? 0;
    
    // Get paginated results
    $sql = "
        SELECT * FROM ($base_query) as search_results
        $where_clause
        ORDER BY title ASC
        LIMIT $limit OFFSET $offset
    ";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format results
    $formatted_items = [];
    foreach ($items as $item) {
        $formatted_items[] = [
            'book_id' => $item['book_id'],
            'item_id' => $item['item_id'],
            'isbn' => $item['isbn'],
            'title' => $item['title'],
            'author' => $item['author'] ?? 'N/A',
            'publisher' => $item['publisher'] ?? 'N/A',
            'category' => $item['category'] ?? 'N/A',
            'description' => $item['description'] ?? '',
            'price' => $item['unit_price'],
            'stock' => intval($item['quantity_on_hand']),
            'source' => $item['source'],
            'grade_level' => $item['grade_level'] ?? 'N/A'
        ];
    }
    
    echo json_encode([
        'success' => true,
        'items' => $formatted_items,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
