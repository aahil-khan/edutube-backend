import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import pg from 'pg';
import { Client } from "@elastic/elasticsearch";
import redis from 'redis';


const esClient = new Client({ node: 'http://localhost:9200' });

dotenv.config();

const { Pool } = pg;

const db = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: 10,
    // idleTimeoutMillis: 10000,
    // connectionTimeoutMillis: 2000,
    ssl: {
        rejectUnauthorized: false,
    },
});

db.connect();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

redisClient.connect().then(() => {
    console.log('Connected to Redis');
});

const app = express();

const ACCESS_SECRET_KEY = process.env.ACCESS_SECRET_KEY;
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000' , 'https://still-citadel-95346-111a1dcad6bd.herokuapp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
};


app.use(express.static("public"));
app.use(express.json());
app.use(cors(corsOptions));


app.get("/", (req, res) => {
  res.json({message:"Hello World"});
});

app.get("/student_details/:id", async (req, res) => {
    const id = req.params.id;
    const cacheKey = `student_details_${id}`;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const query = `SELECT * FROM users WHERE id = $1`;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            res.status(404).json({ message: "User not found" });
        } else if (result.rows[0].role != "student") {
            res.status(403).json({ message: "User is not a student" });
        } else {
            await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 3600 });
            res.json(result.rows);
        }
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).send('Server error');
    }
});

app.get("/student_enrolled_courses/:id", async (req, res) => {
    const id = req.params.id;
    const cacheKey = `student_enrolled_courses_${id}`;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const query = `
            SELECT c.name AS course_name, u.name AS teacher_name 
            FROM Courses c 
            INNER JOIN Teachers t ON t.course_id = c.id 
            INNER JOIN Users u ON u.id = t.user_id 
            WHERE c.id IN (SELECT e.course_id FROM Enrollments e WHERE e.student_id = $1);
        `;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            res.status(404).json({ message: "User not found" });
        } else {
            await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 3600 });
            res.json(result.rows);
        }
    } catch (error) {
        console.error('Error fetching enrolled courses:', error);
        res.status(500).send('Server error');
    }
});

//add authentication
app.get('/search', async (req, res) => {
    const { keyword, type, courseId, teacherId } = req.query;
    const cacheKey = `search_${keyword}_${type}_${courseId}_${teacherId}`;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const sanitizedKeyword = (keyword || '').replace(/[^\w\s]/g, '').trim();
        if (!sanitizedKeyword) return res.json([]);

        let esQuery = {};

        switch (type) {
            case 'courses':
                esQuery = {
                    index: 'courses',
                    query: {
                        multi_match: {
                            query: sanitizedKeyword,
                            fields: ['name^3', 'course_code^2' ,'description'],
                            fuzziness: 'AUTO'
                        }
                    }
                };
                break;

            case 'lectures':
                esQuery = {
                    index: 'lectures',
                    query: {
                        bool: {
                            must: [
                                { multi_match: { query: sanitizedKeyword, fields: ['title^3', 'chapter_name^2', 'keywords'], fuzziness: 'AUTO' } }
                            ],
                            filter: [
                                courseId ? { term: { course_id: courseId } } : null,
                                teacherId ? { term: { teacher_id: teacherId } } : null
                            ].filter(Boolean)
                        }
                    }
                };
                break;

            case 'teachers':
                esQuery = {
                    index: 'teachers',
                    query: {
                        match: {
                            name: {
                                query: sanitizedKeyword,
                                fuzziness: 'AUTO'
                            }
                        }
                    }
                };
                break;

            default:
                esQuery = {
                    index: ['courses', 'lectures', 'teachers'],
                    query: {
                        multi_match: {
                            query: sanitizedKeyword,
                            fields: ['name^3', 'title^2', 'keywords']
                        }
                    }
                };
                break;
        }

        const { hits } = await esClient.search(esQuery);
        const results = hits.hits.map(hit => {
            const source = hit._source;
            switch (type) {
                case 'courses':
                    return {
                        course_id: source.id,
                        course_name: source.name,
                        teacher_id: source.teacher_id,
                        teacher_name: source.teacher_name,
                        type: source.type,
                    };
                case 'lectures':
                    return {
                        lecture_id: source.id,
                        lecture_title: source.title,
                        chapter_number: source.chapter_number,
                        chapter_name: source.chapter_name,
                        lecture_number: source.lecture_number,
                        course_name: source.course_name,
                        teacher_name: source.teacher_name,
                        teacher_id: source.teacher_id,
                        type: source.type,
                    };
                case 'teachers':
                    return {
                        teacher_id: source.id,
                        teacher_name: source.name,
                        type: source.type,
                    };
                default:
                    if(source.type === 'lecture'){
                        return {
                            course_id: null,
                            course_name: source.course_name,
                            teacher_id: source.teacher_id,
                            teacher_name: source.teacher_name,
                            lecture_id: source.id,
                            lecture_title: source.title,
                            chapter_number: source.chapter_number,
                            lecture_number: source.lecture_number,
                            type: 'lecture',
                        }
                    }else if(source.type === 'course'){
                        return {
                            course_id: source.id,
                            course_name: source.name,
                            teacher_id: source.teacher_id,
                            teacher_name: source.teacher_name,
                            lecture_id: null,
                            lecture_title: null,
                            chapter_number: null,
                            lecture_number: null,
                            type: 'course',
                        }
                    }else if(source.type === 'teacher'){
                        return {
                            course_id: null,
                            course_name: null,
                            teacher_id: source.id,
                            teacher_name: source.name,
                            lecture_id: null,
                            lecture_title: null,
                            chapter_number: null,
                            lecture_number: null,
                            type: 'teacher',
                        }
                    }
            }
        });

        await redisClient.set(cacheKey, JSON.stringify(results), { EX: 3600 });

        res.json(results);
    } catch (error) {
        console.error('Error executing Elasticsearch query:', error.message);
        res.status(500).send('Server error');
    }
});


app.get('/get-user-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const cacheKey = `user_data_${userId}`;

    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const query = `SELECT name, email FROM Users WHERE id = $1`;
        const query2 = `
                        SELECT 
                            e.teacher_id AS teacher_id,
                            c.name AS course_name,
                            u.name AS teacher_name
                            FROM 
                            enrollments e
                            INNER JOIN 
                            teachers t ON e.teacher_id = t.id
                            INNER JOIN 
                            courses c ON t.course_id = c.id
                            INNER JOIN
                            users u on u.id = t.user_id
                        WHERE e.student_id = $1;
        `;
        const result = await db.query(query, [userId]);
        const result2 = await db.query(query2, [userId]);

        const enrolledCourses = result2.rows.map(row => ({
            teacher_id: row.teacher_id,
            teacher_name: row.teacher_name,
            course_name: row.course_name
        }));

        const userData = { name: result.rows[0].name, email: result.rows[0].email, enrolled_courses: enrolledCourses };
        console.log(userData);
        await redisClient.set(cacheKey, JSON.stringify(userData), { EX: 3600 });
        res.json(userData);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Server error');
    }
});

app.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        res.json({ message: `Welcome to your dashboard, ${req.user.name}` });
    } catch (error) {
        console.error('Error in dashboard route:', error);
        res.status(500).send('Server error');
    }
});

app.post('/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    const userResult = await db.query('SELECT password_hash FROM Users WHERE id = $1', [userId]);
    const currentHash = userResult.rows[0].password_hash;

    const isValidPassword = await bcrypt.compare(oldPassword, currentHash);
    if (!isValidPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const query = `UPDATE Users SET password_hash = $1 WHERE id = $2`;
    await db.query(query, [newHash, userId]);

    // Update Redis cache after password change
    const cacheKey = `user_data_${userId}`;
    const updatedUserData = { password_hash: newHash }; // You may want to fetch the updated user data
    await redisClient.set(cacheKey, JSON.stringify(updatedUserData), { EX: 3600 });

    res.status(200).json({ message: "Password changed successfully" });
});

app.post('/enroll_course', authenticateToken, async (req, res) => {
    const client = await db.connect(); 
    try {
        await client.query('BEGIN'); 
        const { studentId, teacherId } = req.body;
        const query = `INSERT INTO enrollments (student_id, teacher_id) VALUES ($1, $2)`;
        await client.query(query, [studentId, teacherId]);
        await client.query('COMMIT');

        // Update Redis cache after enrolling
        const cacheKey = `user_data_${studentId}`;
        const updatedUserData = await db.query('SELECT name, email FROM Users WHERE id = $1', [studentId]);
        const enrolledCoursesQuery = `
            SELECT 
                e.teacher_id AS teacher_id,
                c.name AS course_name,
                u.name AS teacher_name
            FROM 
                enrollments e
            INNER JOIN 
                teachers t ON e.teacher_id = t.id
            INNER JOIN 
                courses c ON t.course_id = c.id
            INNER JOIN
                users u on u.id = t.user_id
            WHERE e.student_id = $1;
        `;
        const enrolledCoursesResult = await db.query(enrolledCoursesQuery, [studentId]);
        const enrolledCourses = enrolledCoursesResult.rows.map(row => ({
            teacher_id: row.teacher_id,
            teacher_name: row.teacher_name,
            course_name: row.course_name
        }));

        const userData = { name: updatedUserData.rows[0].name, email: updatedUserData.rows[0].email, enrolled_courses: enrolledCourses };
        await redisClient.set(cacheKey, JSON.stringify(userData), { EX: 3600 });

        res.status(200).json({ message: "Student enrolled successfully" });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).send("Error:", error.stack);
    } finally {
        client.release();
    }
});

app.delete('/unenroll_course', authenticateToken, async (req, res) => {
    try {
        const { studentId, teacherId } = req.body;
        const query = `DELETE FROM enrollments WHERE student_id = $1 AND teacher_id = $2`;
        await db.query(query, [studentId, teacherId]);

        // Update Redis cache after unenrolling
        const cacheKey = `user_data_${studentId}`;
        const updatedUserData = await db.query('SELECT name, email FROM Users WHERE id = $1', [studentId]);
        const enrolledCoursesQuery = `
            SELECT 
                e.teacher_id AS teacher_id,
                c.name AS course_name,
                u.name AS teacher_name
            FROM 
                enrollments e
            INNER JOIN 
                teachers t ON e.teacher_id = t.id
            INNER JOIN 
                courses c ON t.course_id = c.id
            INNER JOIN
                users u on u.id = t.user_id
            WHERE e.student_id = $1;
        `;
        const enrolledCoursesResult = await db.query(enrolledCoursesQuery, [studentId]);
        const enrolledCourses = enrolledCoursesResult.rows.map(row => ({
            teacher_id: row.teacher_id,
            teacher_name: row.teacher_name,
            course_name: row.course_name
        }));

        const userData = { name: updatedUserData.rows[0].name, email: updatedUserData.rows[0].email, enrolled_courses: enrolledCourses };
        await redisClient.set(cacheKey, JSON.stringify(userData), { EX: 3600 });

        res.status(200).json({ message: "Student unenrolled successfully" });
    } catch (error) {
        res.status(500).send("Error:", error.stack);
    }
});

app.get('/courses/:id', async (req, res) => {
    const teacherId = parseInt(req.params.id);
  
    if (isNaN(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacher ID' });
    }
  
    try {
      const query = `
        SELECT 
            L.chapter_name,
            L.chapter_number,
            L.lecture_number,
            L.title AS lecture_title,
            L.youtube_url AS lecture_path
        FROM 
            Lectures L
        WHERE 
            L.teacher_id = $1
        ORDER BY 
            L.chapter_number, L.lecture_number;
      `;
  
      const { rows } = await db.query(query, [teacherId]);
  
      // Transform the rows into the nested JSON structure
      const result = rows.reduce((acc, row) => {
        let chapter = acc.find(ch => ch.chapter_number === row.chapter_number);
  
        if (!chapter) {
          chapter = {
            chapter_number: row.chapter_number,
            chapter_name: row.chapter_name,
            lectures: [],
          };
          acc.push(chapter);
        }
  
        chapter.lectures.push({
          lecture_number: row.lecture_number,
          lecture_title: row.lecture_title,
          lecture_path: row.lecture_path,
        });
  
        return acc;
      }, []);
  
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
});


//Authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({message:"token not found"});

    jwt.verify(token, ACCESS_SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({message:"token expired"});
        req.user = user;
        next();
    });
}

app.get('/verify-auth', authenticateToken, (req, res) => {
    res.status(200).json({message:"token is valid", role:req.user.role});
});


app.post("/login", async (req, res) => {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    const { email, password } = req.body;

    console.log('Email:', email);
    console.log('Password:', password);


    try {
        const result = await db.query('SELECT id, email, role, password_hash FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'This username does not exist' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const accessToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            ACCESS_SECRET_KEY,                                      
            { expiresIn: '15m' }                               
        );

        const refreshToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role }, 
            REFRESH_SECRET_KEY, 
            { expiresIn: '1d' }                               
        );

        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true });

        res.json({ accessToken, role: user.role });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send("Error:",error.stack);
    }
});


app.post('/refresh-token', (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) return res.sendStatus(401); 

    jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403); 

        // Generate a new access token
        const accessToken = jwt.sign(
            { id: user.id, name: user.name, role: user.role },
            ACCESS_SECRET_KEY,
            { expiresIn: '15m' }
        );

        res.json({ accessToken , role:user.role});
    });
});

app.post('/logout', authenticateToken, (req, res) => {
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.json({ message: 'Logout successful' });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});