<?php
// File: search.php - API endpoint for real-time inventory search
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
    $gradeLevel = $_GET['grade_level'] ?? '';
    $subject = $_GET['subject'] ?? '';
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
    
    // Add stock_status to results
    foreach ($results as &$result) {
        $result['stock_status'] = intval($result['quantity']) > 0 ? 'in_stock' : 'out_of_stock';
    }

    echo json_encode([
        'success' => true,
        'data' => $results,
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

    // For now, return basic info since we don't have a change history table
    $sql = "SELECT item_id, item_name, quantity, last_updated FROM inventory WHERE item_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'history' => [],
        'current' => $item
    ]);
}
?>
