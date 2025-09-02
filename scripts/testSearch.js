/**
 * Test script for PostgreSQL Full-Text Search functionality
 * This script tests the new search endpoints
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000';

// Sample test data
const testQueries = [
    'computer science',
    'math',
    'john',
    'introduction',
    'CS101'
];

const testFilters = {
    courseCode: 'CS',
    teacherName: 'john',
    isActive: true
};

async function testSearchFunctionality() {
    console.log('🧪 Testing PostgreSQL Full-Text Search functionality...\n');
    
    try {
        console.log('📡 Testing quick search endpoint...');
        for (const query of testQueries) {
            try {
                const response = await axios.get(`${BACKEND_URL}/quick-search`, {
                    params: { query, limit: 3 }
                });
                console.log(`✅ Quick search for "${query}":`, response.data.suggestions.length, 'suggestions');
            } catch (error) {
                console.log(`❌ Quick search for "${query}" failed:`, error.response?.data?.message || error.message);
            }
        }

        console.log('\n🔍 Testing advanced search endpoint...');
        
        // Note: This endpoint requires authentication, so this test will fail without a valid token
        // In a real test, you would first login and get a token
        try {
            const response = await axios.post(`${BACKEND_URL}/advanced-search`, {
                query: 'computer',
                type: 'all',
                page: 1,
                limit: 5,
                filters: {},
                sortBy: 'relevance',
                sortOrder: 'desc'
            }, {
                headers: {
                    'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE' // Replace with actual token
                }
            });
            console.log('✅ Advanced search results:', response.data.totalCount, 'total results');
        } catch (error) {
            console.log('❌ Advanced search test skipped (requires authentication):', error.response?.status === 401 ? 'No token provided' : error.message);
        }

        console.log('\n📊 Testing different search types...');
        const searchTypes = ['teachers', 'courses', 'lectures'];
        
        for (const type of searchTypes) {
            try {
                const response = await axios.post(`${BACKEND_URL}/advanced-search`, {
                    query: 'test',
                    type,
                    page: 1,
                    limit: 3
                }, {
                    headers: {
                        'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE' // Replace with actual token
                    }
                });
                console.log(`✅ Search type "${type}":`, response.data[type]?.length || 0, 'results');
            } catch (error) {
                console.log(`❌ Search type "${type}" test skipped:`, error.response?.status === 401 ? 'No token' : error.message);
            }
        }

        console.log('\n🏁 Search functionality test completed!');
        console.log('💡 To run full tests, update the token in this script with a valid JWT.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Instructions for running the test
console.log('🚀 PostgreSQL FTS Search Test');
console.log('📋 Instructions:');
console.log('1. Make sure your backend server is running on port 5000');
console.log('2. Ensure the database is connected and search indexes are applied');
console.log('3. For full testing, replace YOUR_TEST_TOKEN_HERE with a valid JWT token');
console.log('4. Run: node scripts/testSearch.js\n');

// Run the test
testSearchFunctionality();
