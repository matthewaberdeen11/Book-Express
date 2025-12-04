-- Migration to drop enhanced_inventory table as we're now using CSV-based search
DROP TABLE IF EXISTS enhanced_inventory;
