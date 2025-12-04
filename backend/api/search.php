<?php
// File: search.php - API endpoint for real-time inventory search from database
header('Content-Type: application/json');

require_once '../config/database.php';
require_once '../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $conn = get_db_connection();
    $action = $_GET['action'] ?? 'search';
    $page = intval($_GET['page'] ?? 1);
    $limit = intval($_GET['limit'] ?? 50);
    $offset = ($page - 1) * $limit;

    switch ($action) {
        case 'search':
            handleSearch($conn, $page, $offset, $limit);
            break;
        case 'getUpdates':
            handleGetUpdates($conn);
            break;
        case 'getItemDetails':
            handleGetItemDetails($conn);
            break;
        case 'getAdjustmentHistory':
            handleGetAdjustmentHistory($conn);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function handleSearch($conn, $page, $offset, $limit) {
    $searchQuery = $_GET['q'] ?? '';
    $itemId = $_GET['item_id'] ?? '';
    $inStockOnly = isset($_GET['in_stock_only']) && $_GET['in_stock_only'] === 'true';
    
    $params = [];
    $conditions = [];

    // Build search conditions
    if (!empty($searchQuery)) {
        $conditions[] = "(item_name LIKE ? OR item_id LIKE ?)";
        $params[] = "%$searchQuery%";
        $params[] = "%$searchQuery%";
    }
    if (!empty($itemId)) {
        $conditions[] = "item_id = ?";
        $params[] = $itemId;
    }
    if ($inStockOnly) {
        $conditions[] = "quantity > 0";
    }

    $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

    // Count total results
    $countSql = "SELECT COUNT(*) as total FROM inventory $whereClause";
    $countStmt = $conn->prepare($countSql);
    $countStmt->execute($params);
    $totalResult = $countStmt->fetch();
    $total = $totalResult['total'] ?? 0;

    // Get paginated results
    $sql = "SELECT 
                item_id,
                item_name,
                rate,
                quantity
            FROM inventory
            $whereClause
            ORDER BY item_name ASC
            LIMIT " . intval($limit) . " OFFSET " . intval($offset);

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Add stock_status to results and map fields for catalogue
    foreach ($results as &$result) {
        $result['stock_status'] = intval($result['quantity']) > 0 ? 'in_stock' : 'out_of_stock';
        // Map CSV fields to catalogue fields
        $result['title'] = $result['item_name'];
        $result['unit_price'] = $result['rate'];
        $result['quantity_on_hand'] = intval($result['quantity']);
        $result['author'] = 'N/A';
        $result['isbn'] = $result['item_id'];
        $result['grade_level'] = extractGradeLevel($result['item_name']);
        $result['category'] = extractCategory($result['item_name']);
        $result['source'] = 'csv';
    }

    echo json_encode([
        'success' => true,
        'results' => $results,
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($total / $limit)
        ]
    ]);
}

function handleGetItemDetails($conn) {
    $itemId = $_GET['item_id'] ?? '';
    
    if (empty($itemId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Item ID required']);
        return;
    }

    $sql = "SELECT item_id, item_name, rate, quantity
            FROM inventory WHERE item_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$item) {
        http_response_code(404);
        echo json_encode(['error' => 'Item not found']);
        return;
    }

    $stock_status = intval($item['quantity']) > 0 ? 'in_stock' : 'out_of_stock';
    $item['stock_status'] = $stock_status;
    echo json_encode($item);
}

function handleGetUpdates($conn) {
    $since = $_GET['since'] ?? null;
    $limit = intval($_GET['limit'] ?? 200);

    if (!$since) {
        echo json_encode(['results' => [], 'server_time' => time()]);
        return;
    }

    try {
        $sql = "SELECT item_id, item_name, quantity, rate, last_updated 
                FROM inventory 
                WHERE last_updated > DATE_SUB(NOW(), INTERVAL ? SECOND)
                ORDER BY last_updated ASC 
                LIMIT " . intval($limit);
        $stmt = $conn->prepare($sql);
        $stmt->execute([$since]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['results' => $rows, 'server_time' => time()]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function handleGetAdjustmentHistory($conn) {
    $itemId = $_GET['item_id'] ?? '';
    
    if (empty($itemId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Item ID required']);
        return;
    }

    $sql = "SELECT item_id, item_name, quantity, last_updated FROM inventory WHERE item_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'history' => [],
        'current' => $item
    ]);
}

function extractGradeLevel($itemName) {
    // Extract grade level from item name (e.g., "Grade One" -> "1", "K3" -> "K3")
    if (preg_match('/Grade\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)/i', $itemName, $matches)) {
        $gradeText = strtolower($matches[1]);
        $gradeMap = [
            'one' => '1', 'two' => '2', 'three' => '3', 'four' => '4',
            'five' => '5', 'six' => '6', 'seven' => '7', 'eight' => '8',
            'nine' => '9', 'ten' => '10', 'eleven' => '11', 'twelve' => '12'
        ];
        return $gradeMap[$gradeText] ?? $matches[1];
    }
    if (preg_match('/K[0-9]/', $itemName, $matches)) {
        return $matches[0];
    }
    return 'N/A';
}

function extractCategory($itemName) {
    // Extract subject/category from item name
    if (stripos($itemName, 'Mathematics') !== false || stripos($itemName, 'Redicovery') !== false) {
        return 'Mathematics';
    }
    if (stripos($itemName, 'Phonics') !== false) {
        return 'Language Arts';
    }
    if (stripos($itemName, 'Island Jamaica') !== false || stripos($itemName, 'Learn Together') !== false) {
        return 'Social Studies';
    }
    return 'General';
}
?>
