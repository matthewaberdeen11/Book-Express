<?php
// Simple tracking endpoint to log analytics page loads and related events
// Path: backend/api/track_hit.php

header('Content-Type: application/json');

$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}

$logFile = $logDir . '/analytics_hits.log';
$event = $_GET['event'] ?? $_POST['event'] ?? 'page_load';
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$uri = $_SERVER['REQUEST_URI'] ?? '';
$time = date('Y-m-d H:i:s');
$line = sprintf("%s\t%s\t%s\t%s\n", $time, $ip, $event, $uri);
@file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);

echo json_encode(['success' => true, 'logged' => $event]);
exit;
