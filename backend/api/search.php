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
            handleSearch($conn, $offset, $limit);
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

function handleSearch($conn, $offset, $limit) {
    $searchQuery = $_GET['q'] ?? '';
    $itemId = $_GET['item_id'] ?? '';
    $gradeLevel = $_GET['grade_level'] ?? '';
    $subject = $_GET['subject'] ?? '';
    $inStockOnly = isset($_GET['in_stock_only']) && $_GET['in_stock_only'] === 'true';
    
    $params = [];
    $conditions = [];

    // helper: check if a column exists on a table
    $colCheck = $conn->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?");
    $hasInventoryGrade = (bool) ($colCheck->execute(['inventory', 'grade_level']) && $colCheck->fetchColumn() > 0);
    $hasBooksGrade = (bool) ($colCheck->execute(['books', 'grade_level']) && $colCheck->fetchColumn() > 0);
    $hasBooksCategory = (bool) ($colCheck->execute(['books', 'category']) && $colCheck->fetchColumn() > 0);

    // Build search conditions (AC-002.1, AC-002.2)
    if (!empty($searchQuery)) {
        // match against book title, book id (as string), isbn, or author for partial matching
        $conditions[] = "(b.title LIKE ? OR CAST(i.book_id AS CHAR) LIKE ? OR b.isbn LIKE ? OR b.author LIKE ?)";
        $params[] = "%$searchQuery%";
        $params[] = "%$searchQuery%";
        $params[] = "%$searchQuery%";
        $params[] = "%$searchQuery%";
    }

    if (!empty($itemId)) {
        $conditions[] = "i.book_id = ?";
        $params[] = $itemId;
    }

    if (!empty($gradeLevel)) {
        if ($hasInventoryGrade) {
            $conditions[] = "i.grade_level = ?";
            $params[] = $gradeLevel;
        } elseif ($hasBooksGrade) {
            $conditions[] = "b.grade_level = ?";
            $params[] = $gradeLevel;
        }
    }

    if (!empty($subject) && $hasBooksCategory) {
        $conditions[] = "b.category = ?";
        $params[] = $subject;
    }

    if ($inStockOnly) {
        $conditions[] = "i.quantity_on_hand > 0";
    }

    // Build WHERE clause
    $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

    // Count total results - join books + inventory to reflect actual schema
    $countSql = "SELECT COUNT(*) as total FROM inventory i JOIN books b ON i.book_id = b.id " . ($whereClause ? " $whereClause" : "");
    $countStmt = $conn->prepare($countSql);
    $countStmt->execute($params);
    $totalResult = $countStmt->fetch();
    $total = $totalResult['total'] ?? 0;

    // Get paginated results with sorting. Map columns to the frontend expectations:
    // item_id, item_name, quantity, rate
    $sql = "SELECT 
                item_id,
                item_name,
                grade_level,
                subject_category,
                quantity,
                rate,
                publisher,
                supplier,
                status,
                CASE 
                    WHEN quantity > 0 THEN 'in_stock'
                    ELSE 'out_of_stock'
                END as stock_status
            FROM inventory 
            $whereClause
                ORDER BY 
                CASE WHEN i.book_id = ? THEN 0 ELSE 1 END,
                CASE WHEN ? != '' AND b.title LIKE ? THEN 0 ELSE 1 END,
                b.title
                LIMIT " . intval($limit) . " OFFSET " . intval($offset);

            // Add ordering parameters (limit/offset are inlined to avoid binding as strings)
            $orderParams = [$itemId, $searchQuery, "%$searchQuery%"];
            $allParams = array_merge($params, $orderParams);

            $stmt = $conn->prepare($sql);
            $stmt->execute($allParams);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get unique values for filters
    $gradeLevels = getUniqueValues($conn, 'grade_level');
    $subjects = getUniqueValues($conn, 'subject_category');

    // compute page number from offset/limit for use in response
    $safeLimit = max(1, intval($limit));
    $page = intval(floor($offset / $safeLimit) + 1);

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

    // Get item details (AC-002.5)
    $sql = "SELECT 
                i.*, 
                b.title as book_title,
                b.author,
                b.isbn,
                b.edition,
                b.publication_year,
                b.description
            FROM inventory i
            LEFT JOIN books b ON i.book_id = b.id
            WHERE i.book_id = ?";

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
    // Return recently updated inventory rows since a given timestamp
    // Accepts 'since' as UNIX timestamp (seconds) or datetime string
    $since = $_GET['since'] ?? null;
    $limit = intval($_GET['limit'] ?? 200);

    if (!$since) {
        // default: return nothing to avoid heavy payloads
        echo json_encode(['results' => [], 'server_time' => time()]);
        return;
    }

    try {
        if (is_numeric($since)) {
            $sql = "SELECT i.book_id AS item_id, b.title AS item_name, i.quantity_on_hand AS quantity, b.unit_price AS rate, i.last_updated FROM inventory i JOIN books b ON i.book_id = b.id WHERE UNIX_TIMESTAMP(i.last_updated) > ? ORDER BY i.last_updated ASC LIMIT " . intval($limit);
            $stmt = $conn->prepare($sql);
            $stmt->execute([$since]);
        } else {
            $sql = "SELECT i.book_id AS item_id, b.title AS item_name, i.quantity_on_hand AS quantity, b.unit_price AS rate, i.last_updated FROM inventory i JOIN books b ON i.book_id = b.id WHERE i.last_updated > ? ORDER BY i.last_updated ASC LIMIT " . intval($limit);
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

    // Get adjustment history (AC-002.7)
    $sql = "SELECT 
                ah.id,
                ah.previous_quantity,
                ah.new_quantity,
                ah.adjustment_amount,
                ah.adjustment_reason,
                ah.notes,
                u.username as adjusted_by,
                DATE_FORMAT(ah.created_at, '%Y-%m-%d %H:%i:%s') as adjusted_at
            FROM adjustment_history ah
            LEFT JOIN users u ON ah.user_id = u.id
            WHERE ah.item_id = ?
            ORDER BY ah.created_at DESC
            LIMIT ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute([$itemId, $limit]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($history);
}

function getUniqueValues($conn, $column) {
    // Determine whether the column exists in inventory or books, and query accordingly.
    $dbName = $conn->query('SELECT DATABASE()')->fetchColumn();

    // Map friendly names to actual columns in books table
    $booksColumnMap = [
        'subject_category' => 'category'
    ];

    // Check inventory
    $checkInventory = $conn->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = ? AND table_name = 'inventory' AND column_name = ?");
    $checkInventory->execute([$dbName, $column]);
    $inInventory = $checkInventory->fetchColumn() > 0;

    if ($inInventory) {
        $sql = "SELECT DISTINCT `$column` FROM inventory WHERE `$column` IS NOT NULL AND `$column` != '' ORDER BY `$column`";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // Check books (possibly mapped)
    $booksCol = $booksColumnMap[$column] ?? $column;
    $checkBooks = $conn->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_schema = ? AND table_name = 'books' AND column_name = ?");
    $checkBooks->execute([$dbName, $booksCol]);
    $inBooks = $checkBooks->fetchColumn() > 0;

    if ($inBooks) {
        $sql = "SELECT DISTINCT `$booksCol` FROM books WHERE `$booksCol` IS NOT NULL AND `$booksCol` != '' ORDER BY `$booksCol`";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // Fallback: return empty array if column not found
    return [];
}
?>