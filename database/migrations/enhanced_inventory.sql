-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 03, 2025 at 10:45 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `book_express`
--

-- --------------------------------------------------------

--
-- Table structure for table `enhanced_inventory`
--

CREATE TABLE `enhanced_inventory` (
  `id` int(11) NOT NULL,
  `item_id` varchar(50) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `grade_level` varchar(50) DEFAULT NULL,
  `subject_category` varchar(100) DEFAULT NULL,
  `current_stock` int(11) DEFAULT 0,
  `minimum_stock` int(11) DEFAULT 5,
  `maximum_stock` int(11) DEFAULT 100,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `selling_price` decimal(10,2) DEFAULT NULL,
  `price_currency` varchar(3) DEFAULT 'JMD',
  `book_type` varchar(50) DEFAULT NULL COMMENT 'Textbook, Workbook, Reference, etc.',
  `edition` varchar(20) DEFAULT NULL,
  `publication_year` year(4) DEFAULT NULL,
  `original_book_id` int(11) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `warehouse_location` varchar(100) DEFAULT NULL,
  `stock_status` enum('in_stock','low_stock','out_of_stock','discontinued') DEFAULT 'in_stock',
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `last_updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_stock_check` timestamp NULL DEFAULT NULL,
  `formatted_price` varchar(50) GENERATED ALWAYS AS (concat(`price_currency`,' ',format(`selling_price`,2))) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `enhanced_inventory`
--

INSERT INTO `enhanced_inventory` (`id`, `item_id`, `item_name`, `grade_level`, `subject_category`, `current_stock`, `minimum_stock`, `maximum_stock`, `cost_price`, `selling_price`, `price_currency`, `book_type`, `edition`, `publication_year`, `original_book_id`, `supplier_id`, `warehouse_location`, `stock_status`, `is_active`, `created_by`, `last_updated_by`, `created_at`, `updated_at`, `last_stock_check`) VALUES
(1, '7288706000000093261', 'Mathematics Grade 7 Textbook', 'Grade 7', 'Mathematics', 50, 5, 100, 1200.00, 1500.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(2, '7288706000000093262', 'English Grade 7 Reader', 'Grade 7', 'English', 45, 5, 100, 900.00, 1200.00, 'JMD', 'Reader', '2nd', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(3, '7288706000000093263', 'Science Grade 7 Lab Manual', 'Grade 7', 'Science', 30, 3, 50, 1600.00, 2000.00, 'JMD', 'Workbook', '1st', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(4, '7288706000000093264', 'Mathematics Grade 8 Textbook', 'Grade 8', 'Mathematics', 40, 5, 100, 1300.00, 1600.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(5, '7288706000000093265', 'English Grade 8 Literature', 'Grade 8', 'English', 35, 5, 100, 1000.00, 1300.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(6, '7288706000000093266', 'Biology Grade 8', 'Grade 8', 'Science', 25, 3, 50, 1800.00, 2200.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(7, '7288706000000093267', 'Chemistry Grade 9', 'Grade 9', 'Science', 20, 3, 50, 2000.00, 2500.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'low_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(8, '7288706000000093268', 'Social Studies Grade 9', 'Grade 9', 'Social Studies', 18, 5, 100, 1400.00, 1800.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'low_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(9, '7288706000000093269', 'Geography Atlas', 'Grade 8', 'Social Studies', 0, 5, 50, 900.00, 1100.00, 'JMD', 'Reference', '3rd', '2022', NULL, NULL, NULL, 'out_of_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(10, '7288706000000093270', 'Music Theory Book', 'Mixed', 'Music', 0, 3, 30, 700.00, 950.00, 'JMD', 'Reference', '2nd', '2022', NULL, NULL, NULL, 'out_of_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(11, '7288706000000093271', 'Advanced Mathematics', 'Grade 12', 'Mathematics', 2, 5, 50, 2800.00, 3500.00, 'JMD', 'Textbook', '1st', '2023', NULL, NULL, NULL, 'low_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(12, '7288706000000093272', 'Chemistry Lab Kit', 'Grade 11', 'Science', 1, 3, 20, 3300.00, 4200.00, 'JMD', 'Kit', '1st', '2023', NULL, NULL, NULL, 'low_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(13, '7288706000000093273', 'Oxford English Dictionary', 'Mixed', 'English', 15, 3, 30, 1800.00, 2500.00, 'JMD', 'Reference', '12th', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(14, '7288706000000093274', 'World History Encyclopedia', 'Mixed', 'History', 12, 3, 30, 2200.00, 3000.00, 'JMD', 'Reference', '5th', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(15, '7288706000000093275', 'Mathematics Workbook Grade 7', 'Grade 7', 'Mathematics', 60, 10, 200, 600.00, 800.00, 'JMD', 'Workbook', '1st', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL),
(16, '7288706000000093276', 'English Grammar Workbook', 'Mixed', 'English', 55, 10, 200, 500.00, 700.00, 'JMD', 'Workbook', '2nd', '2023', NULL, NULL, NULL, 'in_stock', 1, NULL, NULL, '2025-12-03 21:23:46', '2025-12-03 21:23:46', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `enhanced_inventory`
--
ALTER TABLE `enhanced_inventory`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `item_id` (`item_id`),
  ADD KEY `original_book_id` (`original_book_id`),
  ADD KEY `idx_enh_item_id` (`item_id`),
  ADD KEY `idx_enh_item_name` (`item_name`),
  ADD KEY `idx_enh_grade_subject` (`grade_level`,`subject_category`),
  ADD KEY `idx_enh_stock_status` (`stock_status`),
  ADD KEY `idx_enh_search_all` (`item_id`,`item_name`,`grade_level`,`subject_category`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `enhanced_inventory`
--
ALTER TABLE `enhanced_inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `enhanced_inventory`
--
ALTER TABLE `enhanced_inventory`
  ADD CONSTRAINT `enhanced_inventory_ibfk_1` FOREIGN KEY (`original_book_id`) REFERENCES `books` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
