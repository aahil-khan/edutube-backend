// Test script to verify content management functionality
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// You'll need to get an admin token first
const ADMIN_TOKEN = 'your_admin_token_here'; // Replace with actual admin token

const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
};

async function testContentManagement() {
    try {
        console.log('🚀 Testing Content Management System...\n');

        // Step 1: Create Course Template
        console.log('1️⃣ Creating Course Template...');
        const templateResponse = await axios.post(`${BASE_URL}/admin/course-templates`, {
            course_code: 'TEST101',
            name: 'Test Programming Course',
            description: 'A test course for programming fundamentals'
        }, { headers });
        
        const template = templateResponse.data;
        console.log('✅ Course Template Created:', template.course_code);

        // Step 2: Create Course Instance
        console.log('\n2️⃣ Creating Course Instance...');
        const instanceResponse = await axios.post(`${BASE_URL}/admin/course-instances`, {
            course_template_id: template.id,
            teacher_id: 1, // Assuming teacher with ID 1 exists
            instance_name: 'Test Batch 2025'
        }, { headers });
        
        const instance = instanceResponse.data.instance;
        console.log('✅ Course Instance Created:', instance.instance_name);

        // Step 3: Create Chapters
        console.log('\n3️⃣ Creating Chapters...');
        
        const chapter1Response = await axios.post(`${BASE_URL}/admin/chapters`, {
            course_instance_id: instance.id,
            name: 'Introduction to Programming',
            description: 'Basic programming concepts',
            number: 1
        }, { headers });
        
        const chapter1 = chapter1Response.data.chapter;
        console.log('✅ Chapter 1 Created:', chapter1.name);

        const chapter2Response = await axios.post(`${BASE_URL}/admin/chapters`, {
            course_instance_id: instance.id,
            name: 'Variables and Data Types',
            description: 'Understanding variables and data types',
            number: 2
        }, { headers });
        
        const chapter2 = chapter2Response.data.chapter;
        console.log('✅ Chapter 2 Created:', chapter2.name);

        // Step 4: Create Lectures
        console.log('\n4️⃣ Creating Lectures...');
        
        // Lecture 1 in Chapter 1
        const lecture1Response = await axios.post(`${BASE_URL}/admin/lectures`, {
            title: 'What is Programming?',
            description: 'An introduction to programming concepts',
            youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Test URL
            chapter_id: chapter1.id,
            lecture_number: 1
        }, { headers });
        
        const lecture1 = lecture1Response.data.lecture;
        console.log('✅ Lecture 1 Created:', lecture1.title);

        // Lecture 2 in Chapter 1
        const lecture2Response = await axios.post(`${BASE_URL}/admin/lectures`, {
            title: 'Setting Up Your Environment',
            description: 'How to set up your programming environment',
            youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Test URL
            chapter_id: chapter1.id,
            lecture_number: 2
        }, { headers });
        
        const lecture2 = lecture2Response.data.lecture;
        console.log('✅ Lecture 2 Created:', lecture2.title);

        // Lecture 1 in Chapter 2
        const lecture3Response = await axios.post(`${BASE_URL}/admin/lectures`, {
            title: 'Understanding Variables',
            description: 'How variables work in programming',
            youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Test URL
            chapter_id: chapter2.id,
            lecture_number: 1
        }, { headers });
        
        const lecture3 = lecture3Response.data.lecture;
        console.log('✅ Lecture 3 Created:', lecture3.title);

        // Step 5: Verify Content Structure
        console.log('\n5️⃣ Verifying Content Structure...');
        
        const chaptersResponse = await axios.get(`${BASE_URL}/admin/course-instances/${instance.id}/chapters`, { headers });
        console.log('✅ Chapters Retrieved:', chaptersResponse.data.chapters.length, 'chapters');

        const lecturesResponse = await axios.get(`${BASE_URL}/admin/course-instances/${instance.id}/lectures`, { headers });
        console.log('✅ Lectures Retrieved:', lecturesResponse.data.lectures.length, 'lectures');

        console.log('\n🎉 Content Management Test Completed Successfully!');
        console.log('\n📊 Summary:');
        console.log(`   📚 Course Template: ${template.course_code} - ${template.name}`);
        console.log(`   🎓 Course Instance: ${instance.instance_name}`);
        console.log(`   📖 Chapters: ${chaptersResponse.data.chapters.length}`);
        console.log(`   🎥 Lectures: ${lecturesResponse.data.lectures.length}`);

    } catch (error) {
        console.error('❌ Error during testing:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n💡 Tip: Make sure to update the ADMIN_TOKEN in the script with a valid admin token');
        }
    }
}

// Run the test
testContentManagement();
