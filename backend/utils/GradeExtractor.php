<?php
/**
 * Grade extraction and utility functions
 * Parses grade level from book titles
 */

class GradeExtractor {
    
    /**
     * Extract grade level from book title
     * Supports: K1, K2, K3, Grade One-Thirteen, Kindergarten, Infant Book 1, Pre-K, etc.
     * 
     * @param string $title The book title
     * @return string|null The extracted grade level or null
     */
    public static function extractGrade($title) {
        if (empty($title)) {
            return null;
        }
        
        $title = strtolower($title);
        
        // Kindergarten variations
        if (preg_match('/\bkindergarten\s*(1|2|3)?\b|\bkinder\s*(\d)\b|\bk\s*(\d)\b|\bk(\d)\b/i', $title, $matches)) {
            if (!empty($matches[1])) return 'K' . $matches[1];
            if (!empty($matches[2])) return 'K' . $matches[2];
            if (!empty($matches[3])) return 'K' . $matches[3];
            if (!empty($matches[4])) return 'K' . $matches[4];
            return 'K1'; // Default kindergarten
        }
        
        // Pre-Kindergarten
        if (preg_match('/\b(pre-?k|preschool|pre-school|prek|infant\s+book\s+1)\b/i', $title)) {
            return 'Pre-K';
        }
        
        // Grade levels: Grade One, Grade 1, 1 Grade, etc.
        $grade_words = [
            'one' => '1', 'two' => '2', 'three' => '3', 'four' => '4', 'five' => '5',
            'six' => '6', 'seven' => '7', 'eight' => '8', 'nine' => '9', 'ten' => '10',
            'eleven' => '11', 'twelve' => '12', 'thirteen' => '13'
        ];
        
        foreach ($grade_words as $word => $number) {
            // Pattern: "Grade One", "Grade 1", "One Grade", "1 Grade"
            if (preg_match('/\b(grade\s+' . $word . '|' . $word . '\s+grade|\bgrade\s+' . $number . '|' . $number . '\s+grade\b)/i', $title)) {
                return 'Grade ' . $number;
            }
        }
        
        // CSEC grades (Grade 10 and 11)
        if (preg_match('/\bcsec\b/i', $title)) {
            if (preg_match('/\bgrade\s+(10|11)|(10|11)\s+grade\b/i', $title, $matches)) {
                $grade = !empty($matches[1]) ? $matches[1] : $matches[2];
                return 'Grade ' . $grade;
            }
            return 'CSEC'; // Default CSEC
        }
        
        // CAPE grades (Grade 12 and 13)
        if (preg_match('/\bcape\b/i', $title)) {
            if (preg_match('/\bgrade\s+(12|13)|(12|13)\s+grade\b/i', $title, $matches)) {
                $grade = !empty($matches[1]) ? $matches[1] : $matches[2];
                return 'Grade ' . $grade;
            }
            return 'CAPE'; // Default CAPE
        }
        
        return null;
    }
    
    /**
     * Extract all potential search terms from a title for fuzzy matching
     * 
     * @param string $title The book title
     * @return array Array of search terms
     */
    public static function extractSearchTerms($title) {
        $terms = [];
        
        // Split by common delimiters and special characters
        $parts = preg_split('/[\s\-:;,\/\(\)&]/', $title, -1, PREG_SPLIT_NO_EMPTY);
        
        foreach ($parts as $part) {
            $part = trim($part);
            if (strlen($part) > 2) {  // Only include terms longer than 2 characters
                $terms[] = strtolower($part);
            }
        }
        
        return array_unique($terms);
    }
}
