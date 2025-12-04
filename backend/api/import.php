<?php
// import.php - CSV import API that saves files for search
header('Content-Type: application/json');

error_log('=== CSV IMPORT START ===');

set_error_handler(function($errno, $errstr) {
    error_log('PHP Error: ' . $errstr);
    http_response_code(500);
    echo json_encode(['error' => $errstr, 'processed' => 0, 'successful' => 0, 'errors' => []]);
    exit;
});

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No file uploaded or upload error');
    }

    $importType = $_POST['importType'] ?? 'daily';
    $file = $_FILES['csv']['tmp_name'];

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

    // Save imported books to CSV file for search
    $uploadDir = __DIR__ . '/../../backend/uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $csvPath = $uploadDir . 'imported_books.csv';
    
    // If initial import, create new file; otherwise append
    $mode = ($importType === 'initial') ? 'w' : 'a';
    $handle = fopen($csvPath, $mode);
    
    if (!$handle) {
        throw new Exception('Unable to save CSV file');
    }

    // Write header if it's a new file or initial import
    if ($importType === 'initial') {
        fputcsv($handle, $header);
    }

    // Write data rows
    $successCount = 0;
    foreach ($rows as $row) {
        $values = [];
        foreach ($header as $col) {
            $values[] = $row[$col] ?? '';
        }
        fputcsv($handle, $values);
        $successCount++;
    }
    fclose($handle);

    $summary = [
        'processed' => count($rows),
        'successful' => $successCount,
        'unrecognized' => [],
        'discrepancies' => [],
        'errors' => [],
        'total_sales' => 0,
        'message' => 'Books imported successfully and saved to search database'
    ];

    error_log('Import Complete: Saved ' . $successCount . ' rows');

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
?>
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

