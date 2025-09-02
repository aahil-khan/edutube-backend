/**
 * PostgreSQL Full-Text Search Utilities
 * Provides helper functions for advanced search functionality
 */

/**
 * Creates a PostgreSQL tsquery string with fuzzy search capabilities
 * @param {string} query - The search query
 * @param {object} options - Search options
 * @returns {string} - Formatted tsquery string
 */
export const createTsQuery = (query, options = {}) => {
    const { 
        fuzzy = true,           // Enable fuzzy matching
        prefixMatch = true,     // Enable prefix matching
        minWordLength = 2       // Minimum word length for processing
    } = options;

    if (!query || typeof query !== 'string') {
        return '';
    }

    // Split the query into words and handle special characters
    const words = query
        .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
        .split(/\s+/)
        .filter(word => word.length >= minWordLength)
        .map(word => {
            let processedWord = word;
            
            // Add prefix matching for longer words
            if (prefixMatch && word.length >= 3) {
                processedWord = `${word}:*`;
            }
            
            return processedWord;
        });

    // Join words with OR operator for broader matching
    return words.join(' | ');
};

/**
 * Creates a similarity search query using trigram matching
 * @param {string} query - The search query
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {string} - Formatted similarity query
 */
export const createSimilarityQuery = (query, threshold = 0.3) => {
    if (!query || typeof query !== 'string') {
        return '';
    }
    
    return query.trim();
};

/**
 * Builds a WHERE clause for PostgreSQL FTS queries
 * @param {string} searchQuery - The search query
 * @param {Array} searchFields - Fields to search in
 * @param {object} filters - Additional filters
 * @returns {object} - Where clause and parameters
 */
export const buildSearchWhereClause = (searchQuery, searchFields = [], filters = {}) => {
    const whereConditions = [];
    const searchTerms = [];

    // Add full-text search condition
    if (searchQuery && searchFields.length > 0) {
        const tsQuery = createTsQuery(searchQuery);
        if (tsQuery) {
            const fieldsExpression = searchFields.join(" || ' ' || ");
            whereConditions.push(`(
                to_tsvector('english', ${fieldsExpression}) @@ to_tsquery('english', $${searchTerms.length + 1})
            )`);
            searchTerms.push(tsQuery);
        }
    }

    // Add filter conditions
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'string') {
                whereConditions.push(`${key} ILIKE $${searchTerms.length + 1}`);
                searchTerms.push(`%${value}%`);
            } else if (typeof value === 'boolean') {
                whereConditions.push(`${key} = $${searchTerms.length + 1}`);
                searchTerms.push(value);
            } else {
                whereConditions.push(`${key} = $${searchTerms.length + 1}`);
                searchTerms.push(value);
            }
        }
    });

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    return { whereClause, searchTerms };
};

/**
 * Builds an ORDER BY clause with relevance scoring
 * @param {string} searchQuery - The search query
 * @param {Array} searchFields - Fields used for relevance scoring
 * @param {string} sortBy - Sort field
 * @param {string} sortOrder - Sort order (asc/desc)
 * @returns {string} - ORDER BY clause
 */
export const buildOrderByClause = (searchQuery, searchFields = [], sortBy = 'relevance', sortOrder = 'desc') => {
    let orderClause = 'ORDER BY ';
    
    if (sortBy === 'relevance' && searchQuery && searchFields.length > 0) {
        const fieldsExpression = searchFields.join(" || ' ' || ");
        orderClause += `ts_rank(to_tsvector('english', ${fieldsExpression}), to_tsquery('english', $1)) DESC`;
    } else if (sortBy === 'similarity' && searchQuery) {
        // For trigram similarity sorting
        orderClause += `similarity(${searchFields[0]}, $1) DESC`;
    } else {
        // Default sorting
        const sortField = sortBy === 'name' ? searchFields[0] || 'name' : 'created_at';
        orderClause += `${sortField} ${sortOrder.toUpperCase()}`;
    }
    
    return orderClause;
};

/**
 * Calculates pagination parameters
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {object} - Pagination parameters
 */
export const calculatePagination = (page = 1, limit = 10) => {
    const normalizedPage = Math.max(1, parseInt(page));
    const normalizedLimit = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
    const offset = (normalizedPage - 1) * normalizedLimit;
    
    return {
        page: normalizedPage,
        limit: normalizedLimit,
        offset
    };
};

/**
 * Formats search results with metadata
 * @param {Array} results - Raw search results
 * @param {number} total - Total count
 * @param {object} pagination - Pagination info
 * @returns {object} - Formatted results
 */
export const formatSearchResults = (results, total, pagination) => {
    const { page, limit, offset } = pagination;
    const hasMore = offset + results.length < total;
    
    return {
        data: results,
        pagination: {
            page,
            limit,
            total,
            hasMore,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Highlights search terms in text
 * @param {string} text - Text to highlight
 * @param {string} searchQuery - Search query
 * @returns {string} - Text with highlighted terms
 */
export const highlightSearchTerms = (text, searchQuery) => {
    if (!text || !searchQuery) return text;
    
    const terms = searchQuery
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 1);
    
    let highlightedText = text;
    
    terms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
};

/**
 * Validates search parameters
 * @param {object} params - Search parameters
 * @returns {object} - Validation result
 */
export const validateSearchParams = async (params) => {
    const { query, type, page, limit, filters } = await params;
    const errors = [];
    
    // Validate query
    if (query && typeof query !== 'string') {
        errors.push('Query must be a string');
    }
    
    if (query && query.length > 500) {
        errors.push('Query is too long (max 500 characters)');
    }
    
    // Validate type
    const validTypes = ['all', 'teachers', 'courses', 'students', 'lectures'];
    if (type && !validTypes.includes(type)) {
        errors.push(`Invalid search type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Validate pagination
    if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
        errors.push('Page must be a positive integer');
    }
    
    if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
        errors.push('Limit must be an integer between 1 and 100');
    }
    
    // Validate filters
    if (filters && typeof filters !== 'object') {
        errors.push('Filters must be an object');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Performance monitoring for search queries
 * @param {string} queryName - Name of the query for logging
 * @param {Function} queryFunction - Query function to execute
 * @returns {Promise} - Query result with timing
 */
export const monitorSearchPerformance = async (queryName, queryFunction) => {
    const startTime = Date.now();
    
    try {
        const result = await queryFunction();
        const duration = Date.now() - startTime;
        
        console.log(`Search query "${queryName}" completed in ${duration}ms`);
        
        if (duration > 1000) {
            console.warn(`Slow search query detected: "${queryName}" took ${duration}ms`);
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Search query "${queryName}" failed after ${duration}ms:`, error);
        throw error;
    }
};
