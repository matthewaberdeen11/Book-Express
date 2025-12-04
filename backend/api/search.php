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
    $conditions = ["is_active = 1"];

    // Build search conditions
    if (!empty($searchQuery)) {
        $conditions[] = "(item_name LIKE ? OR item_id LIKE ? OR book_type LIKE ?)";
        $params[] = "%$searchQuery%";
        $params[] = "%$searchQuery%";
        $params[] = "%$searchQuery%";
    }
    if (!empty($itemId)) {
        $conditions[] = "item_id = ?";
        $params[] = $itemId;
    }
    if (!empty($gradeLevel)) {
        $conditions[] = "grade_level = ?";
        $params[] = $gradeLevel;
    }
    if (!empty($subject)) {
        $conditions[] = "subject_category = ?";
        $params[] = $subject;
    }
    if ($inStockOnly) {
        $conditions[] = "current_stock > 0";
    }

    $whereClause = "WHERE " . implode(" AND ", $conditions);

    // Count total results
    $countSql = "SELECT COUNT(*) as total FROM enhanced_inventory $whereClause";
    $countStmt = $conn->prepare($countSql);
    $countStmt->execute($params);
    $totalResult = $countStmt->fetch();
    $total = $totalResult['total'] ?? 0;

    // Get paginated results
    $sql = "SELECT 
                item_id,
                item_name,
                grade_level,
                subject_category,
                current_stock AS quantity,
                selling_price AS rate,
                stock_status
            FROM enhanced_inventory
            $whereClause
            ORDER BY item_name ASC
            LIMIT " . intval($limit) . " OFFSET " . intval($offset);

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get unique values for filters
    $gradeLevels = getUniqueValues($conn, 'grade_level');
    $subjects = getUniqueValues($conn, 'subject_category');

    echo json_encode([
        'results' => $results,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'filters' => [
            'grade_levels' => $gradeLevels,
            'subjects' => $subjects
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

    $sql = "SELECT * FROM enhanced_inventory WHERE item_id = ? AND is_active = 1";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$item) {
        http_response_code(404);
        echo json_encode(['error' => 'Item not found']);
        return;
    }

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
        if (is_numeric($since)) {
            $sql = "SELECT item_id, item_name, current_stock AS quantity, selling_price AS rate, updated_at FROM enhanced_inventory WHERE UNIX_TIMESTAMP(updated_at) > ? AND is_active = 1 ORDER BY updated_at ASC LIMIT " . intval($limit);
            $stmt = $conn->prepare($sql);
            $stmt->execute([$since]);
        } else {
            $sql = "SELECT item_id, item_name, current_stock AS quantity, selling_price AS rate, updated_at FROM enhanced_inventory WHERE updated_at > ? AND is_active = 1 ORDER BY updated_at ASC LIMIT " . intval($limit);
            $stmt = $conn->prepare($sql);
            $stmt->execute([$since]);
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['results' => $rows, 'server_time' => time()]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function handleGetAdjustmentHistory($conn) {
    $itemId = $_GET['item_id'] ?? '';
    $limit = intval($_GET['limit'] ?? 20);
    
    if (empty($itemId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Item ID required']);
        return;
    }

    // Return basic info since adjustment_history table may not exist
    $sql = "SELECT id, current_stock, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as adjusted_at FROM enhanced_inventory WHERE item_id = ? ORDER BY updated_at DESC LIMIT ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$itemId, $limit]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($history);
}

function getUniqueValues($conn, $column) {
    $allowedColumns = ['grade_level', 'subject_category', 'stock_status', 'book_type'];
    
    if (!in_array($column, $allowedColumns)) {
        return [];
    }

    $sql = "SELECT DISTINCT `$column` FROM enhanced_inventory WHERE `$column` IS NOT NULL AND `$column` != '' AND is_active = 1 ORDER BY `$column`";
    $stmt = $conn->prepare($sql);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}
?>