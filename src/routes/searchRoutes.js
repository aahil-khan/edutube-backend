import express from 'express';
import { search, advancedSearch, quickSearch } from '../controllers/searchController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Legacy search endpoint (for backward compatibility)
router.post('/search', search);

// New advanced search endpoint with authentication
router.post('/advanced-search', authenticateToken, advancedSearch);

// Quick search for autocomplete/suggestions
router.get('/quick-search', quickSearch);

export default router;
