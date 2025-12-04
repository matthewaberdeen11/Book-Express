<?php
// File: search.php - API endpoint for real-time inventory search from imported CSV
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

function getImportedItems() {
    $csvFile = __DIR__ . '/../../assets/Item_sample.csv';
    $items = [];
    
    if (file_exists($csvFile)) {
        $handle = fopen($csvFile, 'r');
        if ($handle) {
            $header = fgetcsv($handle);
            if ($header) {
                $header = array_map('trim', $header);
                while (($row = fgetcsv($handle)) !== false) {
                    if (!empty(array_filter($row))) {
                        $item = array_combine($header, $row);
                        $items[] = $item;
                    }
                }
            }
            fclose($handle);
        }
    }
    
    return $items;
}

function handleSearch($page, $offset, $limit) {
    $searchQuery = $_GET['q'] ?? '';
    $itemId = $_GET['item_id'] ?? '';
    $inStockOnly = isset($_GET['in_stock_only']) && $_GET['in_stock_only'] === 'true';
    
    $items = getImportedItems();
    $results = [];

    // Filter items based on search criteria
    foreach ($items as $item) {
        $matches = true;
        
        if (!empty($searchQuery)) {
            $matchesSearch = (stripos($item['Item Name'] ?? '', $searchQuery) !== false ||
                            stripos($item['Item ID'] ?? '', $searchQuery) !== false);
            $matches = $matches && $matchesSearch;
        }
        
        if (!empty($itemId)) {
            $matches = $matches && ($item['Item ID'] ?? '' === $itemId);
        }
        
        if ($inStockOnly) {
            $quantity = intval($item['Stock'] ?? $item['Quantity'] ?? 0);
            $matches = $matches && ($quantity > 0);
        }
        
        if ($matches) {
            $results[] = [
                'item_id' => $item['Item ID'] ?? '',
                'item_name' => $item['Item Name'] ?? '',
                'rate' => floatval($item['Rate'] ?? 0),
                'quantity' => intval($item['Stock'] ?? $item['Quantity'] ?? 0),
                'stock_status' => (intval($item['Stock'] ?? 0) > 0) ? 'in_stock' : 'out_of_stock'
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
            'page' => $page,
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

    $items = getImportedItems();
    
    foreach ($items as $item) {
        if (($item['Item ID'] ?? '') === $itemId) {
            echo json_encode([
                'item_id' => $item['Item ID'] ?? '',
                'item_name' => $item['Item Name'] ?? '',
                'rate' => floatval($item['Rate'] ?? 0),
                'quantity' => intval($item['Stock'] ?? 0),
                'stock_status' => (intval($item['Stock'] ?? 0) > 0) ? 'in_stock' : 'out_of_stock'
            ]);
            return;
        }
    }
    
    http_response_code(404);
    echo json_encode(['error' => 'Item not found']);
}

function handleGetUpdates() {
    $items = getImportedItems();
    $results = [];
    
    foreach ($items as $item) {
        $results[] = [
            'item_id' => $item['Item ID'] ?? '',
            'item_name' => $item['Item Name'] ?? '',
            'quantity' => intval($item['Stock'] ?? 0),
            'rate' => floatval($item['Rate'] ?? 0)
        ];
    }
    
    echo json_encode([
        'results' => $results,
        'server_time' => time()
    ]);
}

function handleGetAdjustmentHistory() {
    echo json_encode([
        'history' => [],
        'message' => 'No adjustment history available'
    ]);
}
?>
