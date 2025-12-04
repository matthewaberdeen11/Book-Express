<?php
// File: search.php - API endpoint for real-time inventory search from CSV
header('Content-Type: application/json');

require_once '../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $action = $_GET['action'] ?? 'search';
    $page = intval($_GET['page'] ?? 1);
    $limit = intval($_GET['limit'] ?? 50);
    $offset = ($page - 1) * $limit;

    switch ($action) {
        case 'search':
            handleSearch($page, $offset, $limit);
            break;
        case 'getUpdates':
            handleGetUpdates();
            break;
        case 'getItemDetails':
            handleGetItemDetails();
            break;
        case 'getAdjustmentHistory':
            handleGetAdjustmentHistory();
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function getImportedBooks() {
    $csvFile = __DIR__ . '/../../backend/uploads/imported_books.csv';
    $books = [];
    
    if (file_exists($csvFile)) {
        $handle = fopen($csvFile, 'r');
        if ($handle) {
            $header = fgetcsv($handle);
            if ($header) {
                $header = array_map('trim', $header);
                while (($row = fgetcsv($handle)) !== false) {
                    if (!empty(array_filter($row))) {
                        $book = array_combine($header, $row);
                        $books[] = $book;
                    }
                }
            }
            fclose($handle);
        }
    }
    
    return $books;
}

function handleSearch($page, $offset, $limit) {
    $searchQuery = $_GET['q'] ?? '';
    $itemId = $_GET['item_id'] ?? '';
    $gradeLevel = $_GET['grade_level'] ?? '';
    $subject = $_GET['subject'] ?? '';
    $inStockOnly = isset($_GET['in_stock_only']) && $_GET['in_stock_only'] === 'true';
    
    $books = getImportedBooks();
    $results = [];

    // Filter books based on search criteria
    foreach ($books as $book) {
        $matches = true;
        
        if (!empty($searchQuery)) {
            $matchesSearch = (stripos($book['Item Name'] ?? '', $searchQuery) !== false ||
                            stripos($book['Item ID'] ?? '', $searchQuery) !== false ||
                            stripos($book['Product Type'] ?? '', $searchQuery) !== false);
            $matches = $matches && $matchesSearch;
        }
        
        if (!empty($itemId)) {
            $matches = $matches && ($book['Item ID'] ?? '' === $itemId);
        }
        
        if (!empty($gradeLevel)) {
            $matches = $matches && (($book['Grade Level'] ?? '') === $gradeLevel);
        }
        
        if (!empty($subject)) {
            $matches = $matches && (($book['Subject'] ?? '') === $subject);
        }
        
        if ($inStockOnly) {
            $quantity = intval($book['Stock'] ?? $book['Quantity'] ?? $book['current_stock'] ?? 0);
            $matches = $matches && ($quantity > 0);
        }
        
        if ($matches) {
            $results[] = [
                'item_id' => $book['Item ID'] ?? '',
                'item_name' => $book['Item Name'] ?? '',
                'grade_level' => $book['Grade Level'] ?? '',
                'subject_category' => $book['Subject'] ?? '',
                'quantity' => intval($book['Stock'] ?? $book['Quantity'] ?? 0),
                'rate' => floatval($book['Rate'] ?? 0),
                'stock_status' => (intval($book['Stock'] ?? 0) > 0) ? 'in_stock' : 'out_of_stock'
            ];
        }
    }

    // Paginate results
    $total = count($results);
    $paginatedResults = array_slice($results, $offset, $limit);
    
    echo json_encode([
        'success' => true,
        'data' => $paginatedResults,
        'pagination' => [
            'total' => $total,
            'page' => intval($_GET['page'] ?? 1),
            'limit' => $limit,
            'pages' => ceil($total / $limit)
        ]
    ]);
}

function handleGetItemDetails() {
    $itemId = $_GET['item_id'] ?? '';
    
    if (empty($itemId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Item ID required']);
        return;
    }

    $books = getImportedBooks();
    
    foreach ($books as $book) {
        if (($book['Item ID'] ?? '') === $itemId) {
            echo json_encode([
                'item_id' => $book['Item ID'] ?? '',
                'item_name' => $book['Item Name'] ?? '',
                'grade_level' => $book['Grade Level'] ?? '',
                'subject_category' => $book['Subject'] ?? '',
                'quantity' => intval($book['Stock'] ?? 0),
                'rate' => floatval($book['Rate'] ?? 0),
                'cost_price' => floatval($book['Cost Price'] ?? 0),
                'selling_price' => floatval($book['Rate'] ?? 0),
                'book_type' => $book['Product Type'] ?? '',
                'status' => $book['Status'] ?? 'Active',
                'stock_status' => (intval($book['Stock'] ?? 0) > 0) ? 'in_stock' : 'out_of_stock'
            ]);
            return;
        }
    }
    
    http_response_code(404);
    echo json_encode(['error' => 'Item not found']);
}

function handleGetUpdates() {
    // Since we're reading from CSV, return all current data
    // Real-time updates would require a database or file-based tracking system
    $books = getImportedBooks();
    $results = [];
    
    foreach ($books as $book) {
        $results[] = [
            'item_id' => $book['Item ID'] ?? '',
            'item_name' => $book['Item Name'] ?? '',
            'quantity' => intval($book['Stock'] ?? 0),
            'rate' => floatval($book['Rate'] ?? 0)
        ];
    }
    
    echo json_encode([
        'results' => $results,
        'server_time' => time()
    ]);
}

function handleGetAdjustmentHistory() {
    // CSV doesn't track history, return empty array
    echo json_encode([
        'history' => [],
        'message' => 'No adjustment history available for CSV imports'
    ]);
}
?>