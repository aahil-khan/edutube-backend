import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import pg from 'pg';
import redis from 'redis';

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

        let query = '';
        let values = [keyword || '', courseId || null, teacherId || null];

        // Construct the query dynamically based on the "type" filter
        switch (type) {
            case 'courses':
                query = `
                    SELECT 
                        C.id AS course_id,
                        C.name AS course_name,
                        T.id AS teacher_id,
                        COALESCE(U.name, 'No teacher assigned') AS teacher_name,
                        'course' AS type,
                        ts_rank_cd(to_tsvector(C.name), plainto_tsquery($1)) AS rank
                    FROM 
                        Courses C
                    LEFT JOIN 
                        Teachers T ON C.id = T.course_id
                    LEFT JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR to_tsvector(C.name) @@ plainto_tsquery($1))
                    ORDER BY 
                        rank DESC;
                `;
                values = [keyword || ''];
                break;
        
            case 'lectures':
                query = `
                    SELECT
                        L.id AS lecture_id,
                        L.title AS lecture_title, 
                        C.name AS course_name, 
                        U.name AS teacher_name,
                        T.id AS teacher_id, 
                        L.created_at, 
                        'lecture' AS type,
                        ts_rank_cd(to_tsvector(L.title || ' ' || L.keywords), plainto_tsquery($1)) AS rank
                    FROM 
                        Lectures L
                    INNER JOIN 
                        Courses C ON L.course_id = C.id
                    INNER JOIN 
                        Teachers T ON L.teacher_id = T.id
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR to_tsvector(L.title || ' ' || L.keywords) @@ plainto_tsquery($1)) 
                        AND ($2::INTEGER IS NULL OR C.id = $2::INTEGER)
                        AND ($3::INTEGER IS NULL OR U.id = $3::INTEGER)
                    ORDER BY rank DESC;
                `;
                break;
        
            case 'teachers':
                query = `
                    SELECT 
                        U.id AS teacher_id, 
                        U.name AS teacher_name, 
                        'teacher' AS type,
                        ts_rank_cd(to_tsvector(U.name), plainto_tsquery($1)) AS rank
                    FROM 
                        Teachers T
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR to_tsvector(U.name) @@ plainto_tsquery($1))
                    ORDER BY rank DESC;
                `;
                values = [keyword || ''];
                break;
        
            default:
                // Default: Search across all types
                query = `
                    SELECT 
                        C.id AS course_id,
                        C.name AS course_name,
                        T.id AS teacher_id,
                        COALESCE(U.name, 'No teacher assigned') AS teacher_name,
                        NULL AS lecture_id,
                        NULL AS lecture_title,
                        'course' AS type,
                        ts_rank_cd(to_tsvector(C.name), plainto_tsquery($1)) AS rank
                    FROM 
                        Courses C
                    LEFT JOIN 
                        Teachers T ON C.id = T.course_id
                    LEFT JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR to_tsvector(C.name) @@ plainto_tsquery($1))

                    UNION ALL

                    SELECT 
                        NULL AS course_id,
                        C.name AS course_name,
                        T.id AS teacher_id,
                        U.name AS teacher_name,
                        L.id AS lecture_id,
                        L.title AS lecture_title,
                        'lecture' AS type,
                        ts_rank_cd(to_tsvector(L.title || ' ' || L.keywords), plainto_tsquery($1)) AS rank
                    FROM 
                        Lectures L
                    INNER JOIN 
                        Courses C ON L.course_id = C.id
                    INNER JOIN 
                        Teachers T ON L.teacher_id = T.id
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR to_tsvector(L.title || ' ' || L.keywords) @@ plainto_tsquery($1))
                        AND ($2::INTEGER IS NULL OR C.id = $2::INTEGER)
                        AND ($3::INTEGER IS NULL OR U.id = $3::INTEGER)

                    UNION ALL

                    SELECT 
                        NULL AS course_id,
                        NULL AS course_name,
                        U.id AS teacher_id,
                        U.name AS teacher_name,
                        NULL AS lecture_id,
                        NULL AS lecture_title,
                        'teacher' AS type,
                        ts_rank_cd(to_tsvector(U.name), plainto_tsquery($1)) AS rank
                    FROM 
                        Teachers T
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR to_tsvector(U.name) @@ plainto_tsquery($1))

                    ORDER BY 
                        rank DESC;
                    `;
                values = [keyword || '', courseId || null, teacherId || null];
                break;
        }
        

        const result = await db.query(query, values);
        await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 3600 });
        res.json(result.rows);
    } catch (error) {
        console.error('Error executing query', error);
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
        // const query2 = `
        //     SELECT 
        //         c.id AS course_id,
        //         c.name AS course_name,
        //         t.name AS teacher_name
        //     FROM 
        //         enrollments e
        //     INNER JOIN 
        //         courses c ON e.course_id = c.id
        //     INNER JOIN 
        //         users t ON e.teacher_id = t.id
        //     WHERE e.student_id = $1
        // `;
        const result = await db.query(query, [userId]);
        // const result2 = await db.query(query2, [userId]);

        const userData = { name: result.rows[0].name, email: result.rows[0].email };
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
    res.status(200).json({message:"Password changed successfully"});
});

app.post('/enroll_course', authenticateToken, async (req, res) => {
    try{
        const { studentId, teacherId } = req.body;
        const query = `INSERT INTO enrollments (student_id, teacher_id) VALUES ($1, $2)`;
        await db.query(query, [studentId, teacherId]);
        res.status(200).json({message:"Student enrolled successfully"});
    }catch(error){
        res.status(500).send("Error:",error.stack);
    }
});

app.delete('/unenroll_course', authenticateToken, async (req, res) => {
    try{
        const { studentId, teacherId } = req.body;
        const query = `DELETE FROM enrollments WHERE student_id = $1 AND teacher_id = $2`;
        await db.query(query, [studentId, teacherId]);
        res.status(200).json({message:"Student unenrolled successfully"});
    }catch(error){
        res.status(500).send("Error:",error.stack);
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