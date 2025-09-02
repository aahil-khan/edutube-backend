/**
 * Script to apply PostgreSQL Full-Text Search indexes
 * Run this script to optimize search performance
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applySearchIndexes() {
    console.log('🔍 Applying PostgreSQL Full-Text Search indexes...');
    
    try {
        // Apply all the indexes from the migration file
        const indexQueries = [
            // Full-text search indexes
            `CREATE INDEX IF NOT EXISTS idx_users_fts ON users USING gin(to_tsvector('english', name || ' ' || email))`,
            `CREATE INDEX IF NOT EXISTS idx_course_templates_fts ON course_templates USING gin(to_tsvector('english', name || ' ' || course_code || ' ' || COALESCE(description, '')))`,
            `CREATE INDEX IF NOT EXISTS idx_lectures_fts ON lectures USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')))`,
            `CREATE INDEX IF NOT EXISTS idx_chapters_fts ON chapters USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')))`,
            
            // Partial indexes
            `CREATE INDEX IF NOT EXISTS idx_course_instances_active ON course_instances (is_active) WHERE is_active = true`,
            
            // Composite indexes
            `CREATE INDEX IF NOT EXISTS idx_course_instances_teacher_template ON course_instances (teacher_id, course_template_id)`,
            `CREATE INDEX IF NOT EXISTS idx_chapters_course_instance ON chapters (course_instance_id, number)`,
            `CREATE INDEX IF NOT EXISTS idx_lectures_chapter ON lectures (chapter_id, lecture_number)`,
            `CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON enrollments (student_id, course_instance_id)`,
            `CREATE INDEX IF NOT EXISTS idx_watch_history_user_lecture ON watch_history (user_id, lecture_id)`,
            
            // Filter indexes
            `CREATE INDEX IF NOT EXISTS idx_course_templates_course_code ON course_templates (course_code)`,
            `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
            
            // Date sorting indexes
            `CREATE INDEX IF NOT EXISTS idx_course_instances_created_at ON course_instances (created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_lectures_created_at ON lectures (created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC)`,
            
            // Tag indexes
            `CREATE INDEX IF NOT EXISTS idx_lecture_tags_tag ON lecture_tags (tag)`,
            `CREATE INDEX IF NOT EXISTS idx_lecture_tags_lecture_tag ON lecture_tags (lecture_id, tag)`
        ];

        // Apply trigram extension and indexes (these might fail if extension isn't available)
        const trigramQueries = [
            `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
            `CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin(name gin_trgm_ops)`,
            `CREATE INDEX IF NOT EXISTS idx_course_templates_name_trgm ON course_templates USING gin(name gin_trgm_ops)`,
            `CREATE INDEX IF NOT EXISTS idx_course_templates_code_trgm ON course_templates USING gin(course_code gin_trgm_ops)`,
            `CREATE INDEX IF NOT EXISTS idx_lectures_title_trgm ON lectures USING gin(title gin_trgm_ops)`
        ];

        console.log('📊 Applying standard indexes...');
        for (const query of indexQueries) {
            try {
                await prisma.$executeRawUnsafe(query);
                console.log('✅ Applied:', query.split(' ON ')[1]?.split(' ')[0] || 'index');
            } catch (error) {
                console.warn('⚠️  Skipped:', query.split(' ON ')[1]?.split(' ')[0] || 'index', '- Error:', error.message);
            }
        }

        console.log('🔤 Applying trigram indexes (optional)...');
        for (const query of trigramQueries) {
            try {
                await prisma.$executeRawUnsafe(query);
                console.log('✅ Applied trigram:', query.includes('EXTENSION') ? 'pg_trgm extension' : query.split(' ON ')[1]?.split(' ')[0] || 'index');
            } catch (error) {
                console.warn('⚠️  Skipped trigram:', query.includes('EXTENSION') ? 'pg_trgm extension' : query.split(' ON ')[1]?.split(' ')[0] || 'index', '- Error:', error.message);
            }
        }

        console.log('🎉 Search indexes applied successfully!');
        console.log('💡 Your PostgreSQL Full-Text Search is now optimized for better performance.');
        
    } catch (error) {
        console.error('❌ Error applying search indexes:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
applySearchIndexes();
