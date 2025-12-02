<?php
// import.php - CSV import API for both initial inventory and daily sales
header('Content-Type: application/json');

error_log('=== CSV IMPORT START ===');

set_error_handler(function($errno, $errstr) {
    error_log('PHP Error: ' . $errstr);
    http_response_code(500);
    echo json_encode(['error' => $errstr, 'processed' => 0, 'successful' => 0, 'errors' => []]);
    exit;
});

try {
    require_once '../config/database.php';
    
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No file uploaded or upload error');
    }

    $importType = $_POST['importType'] ?? 'daily';
    $file = $_FILES['csv']['tmp_name'];
    $conn = get_db_connection();

    error_log("Import Type: $importType");
    error_log("File: " . $_FILES['csv']['name']);

    // Read CSV file
    $rows = [];
    $handle = fopen($file, 'r');
    if (!$handle) {
        throw new Exception('Unable to open CSV file');
    }

    $header = fgetcsv($handle);
    if (!$header) {
        throw new Exception('CSV file is empty or invalid');
    }

    // Trim header column names
    $header = array_map('trim', $header);
    error_log('CSV Header: ' . json_encode($header));

    // Read all data rows
    while (($data = fgetcsv($handle)) !== false) {
        if (empty(array_filter($data))) {
            continue; // Skip empty rows
        }
        $data = array_map('trim', $data);
        $row = array_combine($header, $data);
        if ($row !== false) {
            $rows[] = $row;
        }
    }
    fclose($handle);

    error_log('Rows parsed: ' . count($rows));

    if (empty($rows)) {
        throw new Exception('No data rows found in CSV');
    }

    // Process based on import type
    $summary = [
        'processed' => 0,
        'successful' => 0,
        'unrecognized' => [],
        'discrepancies' => [],
        'errors' => [],
        'total_sales' => 0
    ];

    if ($importType === 'initial') {
        $summary = processInitialImport($rows, $conn, $summary);
    } else {
        $summary = processDailyImport($rows, $conn, $summary);
    }

    // Log import activity
    logImport($_FILES['csv']['name'], $importType, $summary, $conn);

    error_log('Final Summary: Processed=' . $summary['processed'] . ', Successful=' . $summary['successful'] . ', Errors=' . count($summary['errors']));

    echo json_encode($summary);

} catch (Exception $e) {
    error_log('Import Exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'processed' => 0,
        'successful' => 0,
        'unrecognized' => [],
        'discrepancies' => [],
        'errors' => []
    ]);
}

/**
 * Process Initial Inventory Import
 * Columns: Item ID, Item Name, Rate, Product Type, Status
 */
function processInitialImport($rows, $conn, $summary) {
    error_log('=== INITIAL IMPORT START ===');
    
    foreach ($rows as $idx => $row) {
        $summary['processed']++;

        // Extract values from CSV
        $item_id = trim($row['Item ID'] ?? '');
        $item_name = trim($row['Item Name'] ?? '');
        $rate = trim($row['Rate'] ?? '');
        $product_type = trim($row['Product Type'] ?? 'goods');
        $status = trim($row['Status'] ?? 'Active');

        error_log("Row $idx: ID='$item_id', Name='$item_name', Rate='$rate'");

        // Validate required fields
        if (!$item_id || !$item_name || !$rate) {
            $error = 'Missing required: ';
            if (!$item_id) $error .= 'Item ID, ';
            if (!$item_name) $error .= 'Item Name, ';
            if (!$rate) $error .= 'Rate, ';
            $summary['errors'][] = ['row' => $idx, 'error' => rtrim($error, ', ')];
            error_log("Row $idx - FAILED: $error");
            continue;
        }

        // Extract numeric rate from format like "JMD 2390.00"
        $rate_numeric = floatval(preg_replace('/[^\d.]/', '', $rate));
        if ($rate_numeric <= 0) {
            $summary['errors'][] = ['row' => $idx, 'error' => "Invalid rate: $rate"];
            error_log("Row $idx - FAILED: Invalid rate");
            continue;
        }

        // Check if item already exists
        try {
            $stmt = $conn->prepare('SELECT id FROM inventory WHERE item_id = ?');
            $stmt->execute([$item_id]);
            if ($stmt->rowCount() > 0) {
                error_log("Row $idx - SKIPPED: Already exists");
                continue;
            }

            // Insert new item with quantity = 0 (fresh inventory)
            // book_id is NULL because CSV imports are independent of books table
            $stmt = $conn->prepare('
                INSERT INTO inventory (book_id, item_id, item_name, rate, product_type, status, quantity) 
                VALUES (NULL, ?, ?, ?, ?, ?, 0)
            ');
            $stmt->execute([$item_id, $item_name, $rate, $product_type, $status]);
            $summary['successful']++;
            error_log("Row $idx - SUCCESS: Inserted");

        } catch (PDOException $e) {
            $error = $e->getMessage();
            $summary['errors'][] = ['row' => $idx, 'error' => $error];
            error_log("Row $idx - DB ERROR: $error");
        }
    }

    error_log('=== INITIAL IMPORT COMPLETE: ' . $summary['successful'] . ' successful, ' . count($summary['errors']) . ' errors ===');
    return $summary;
}



/**
 * Process Daily Sales Import
 * Columns: item_id, item_name, quantity_sold, amount, average_price
 */
function processDailyImport($rows, $conn, $summary) {
    error_log('=== DAILY IMPORT START ===');
    
    $total_sales = 0;

    foreach ($rows as $idx => $row) {
        $summary['processed']++;

        // Extract values from CSV
        $item_id = trim($row['item_id'] ?? '');
        $item_name = trim($row['item_name'] ?? '');
        $quantity_sold = floatval($row['quantity_sold'] ?? 0);
        $amount = floatval($row['amount'] ?? 0);
        $average_price = floatval($row['average_price'] ?? 0);

        error_log("Row $idx: ID='$item_id', QTY=$quantity_sold, Price=$average_price");

        // Validate required fields
        if (!$item_id || !$item_name || $quantity_sold <= 0) {
            $summary['errors'][] = ['row' => $idx, 'error' => 'Missing or invalid required fields'];
            error_log("Row $idx - FAILED: Missing required");
            continue;
        }

        $total_sales += $amount;

        // Find item in inventory
        try {
            $stmt = $conn->prepare('SELECT id, rate, quantity FROM inventory WHERE item_id = ?');
            $stmt->execute([$item_id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$item) {
                // Item not found in inventory
                $summary['unrecognized'][] = $row;
                error_log("Row $idx - UNRECOGNIZED: Item not in inventory");
                continue;
            }

            // Extract stored rate and check price discrepancy
            $stored_rate = floatval(preg_replace('/[^\d.]/', '', $item['rate']));
            
            if ($stored_rate > 0) {
                $price_diff_pct = abs($stored_rate - $average_price) / $stored_rate * 100;
                error_log("Row $idx - Price check: Stored=$stored_rate, CSV=$average_price, Diff=" . round($price_diff_pct, 2) . "%");
                
                if ($price_diff_pct > 10) {
                    $summary['discrepancies'][] = $row;
                    error_log("Row $idx - DISCREPANCY: Price difference > 10%");
                    continue;
                }
            }

            // Update quantity - deduct sales
            $new_quantity = max(0, $item['quantity'] - $quantity_sold);
            $stmt = $conn->prepare('UPDATE inventory SET quantity = ? WHERE id = ?');
            $stmt->execute([$new_quantity, $item['id']]);
            
            $summary['successful']++;
            error_log("Row $idx - SUCCESS: Updated qty from {$item['quantity']} to $new_quantity");

        } catch (PDOException $e) {
            $error = $e->getMessage();
            $summary['errors'][] = ['row' => $idx, 'error' => $error];
            error_log("Row $idx - DB ERROR: $error");
        }
    }

    $summary['total_sales'] = $total_sales;
    error_log('=== DAILY IMPORT COMPLETE: ' . $summary['successful'] . ' successful, ' . count($summary['unrecognized']) . ' unrecognized ===');
    return $summary;
}



/**
 * Log import activity to database
 */
function logImport($filename, $type, $summary, $conn) {
    try {
        $user_id = 1; // Default to manager user
        if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['user_id'])) {
            $user_id = $_SESSION['user_id'];
        }
        
        $status = (count($summary['errors']) > 0 || count($summary['discrepancies']) > 0) ? 'completed_with_issues' : 'completed';
        
        $stmt = $conn->prepare('
            INSERT INTO import_logs 
            (user_id, file_name, import_type, status, rows_processed, rows_failed, uploaded_at, completed_at) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ');
        
        $stmt->execute([
            $user_id,
            $filename,
            $type,
            $status,
            $summary['processed'],
            count($summary['errors'])
        ]);
        
        error_log('Import logged to database');
    } catch (Exception $e) {
        error_log('Failed to log import: ' . $e->getMessage());
    }
}

?>

