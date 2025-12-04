-- Update NULL grade_levels in inventory by extracting from item_name titles
-- This script will be run to backfill missing grade levels

-- First, let's create a temporary procedure to extract grades
-- For items with NULL grade_level, we need to parse the item_name

-- Update items where grade_level is NULL or empty
-- We'll use a simple pattern matching approach here since we can't call PHP function in SQL

-- K1, K2, K3 patterns
UPDATE inventory SET grade_level = 'K1' WHERE grade_level IS NULL AND (item_name LIKE '%K1%' OR item_name LIKE '%Kindergarten 1%' OR item_name LIKE '%Kinder 1%');
UPDATE inventory SET grade_level = 'K2' WHERE grade_level IS NULL AND (item_name LIKE '%K2%' OR item_name LIKE '%Kindergarten 2%' OR item_name LIKE '%Kinder 2%');
UPDATE inventory SET grade_level = 'K3' WHERE grade_level IS NULL AND (item_name LIKE '%K3%' OR item_name LIKE '%Kindergarten 3%' OR item_name LIKE '%Kinder 3%');

-- Pre-K
UPDATE inventory SET grade_level = 'Pre-K' WHERE grade_level IS NULL AND (item_name LIKE '%Pre-K%' OR item_name LIKE '%PreK%' OR item_name LIKE '%Preschool%' OR item_name LIKE '%Pre School%');

-- Grade patterns
UPDATE inventory SET grade_level = 'Grade 1' WHERE grade_level IS NULL AND (item_name LIKE '%Grade 1%' OR item_name LIKE '%Grade One%' OR item_name LIKE '%One Grade%' OR item_name LIKE '%Book 1%');
UPDATE inventory SET grade_level = 'Grade 2' WHERE grade_level IS NULL AND (item_name LIKE '%Grade 2%' OR item_name LIKE '%Grade Two%' OR item_name LIKE '%Two Grade%' OR item_name LIKE '%Book 2%');
UPDATE inventory SET grade_level = 'Grade 3' WHERE grade_level IS NULL AND (item_name LIKE '%Grade 3%' OR item_name LIKE '%Grade Three%' OR item_name LIKE '%Three Grade%' OR item_name LIKE '%Book 3%');
UPDATE inventory SET grade_level = 'Grade 4' WHERE grade_level IS NULL AND (item_name LIKE '%Grade 4%' OR item_name LIKE '%Grade Four%' OR item_name LIKE '%Four Grade%' OR item_name LIKE '%Book 4%');
UPDATE inventory SET grade_level = 'Grade 5' WHERE grade_level IS NULL AND (item_name LIKE '%Grade 5%' OR item_name LIKE '%Grade Five%' OR item_name LIKE '%Five Grade%' OR item_name LIKE '%Book 5%');
UPDATE inventory SET grade_level = 'Grade 6' WHERE grade_level IS NULL AND (item_name LIKE '%Grade 6%' OR item_name LIKE '%Grade Six%' OR item_name LIKE '%Six Grade%' OR item_name LIKE '%Book 6%');

-- For any remaining NULLs, set to 'Ungraded'
UPDATE inventory SET grade_level = 'Ungraded' WHERE grade_level IS NULL OR grade_level = '';
