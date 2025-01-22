import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});


db.connect();

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
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(cors(corsOptions));


app.get("/", (req, res) => {
  res.json({message:"Hello World"});
});

app.get("/student_details/:id", async (req, res) => {
    const id = req.params.id;
    const query = `SELECT * FROM users WHERE id = ${id}`;
    const result = await db.query(query);

    if(result.rows.length === 0){
        res.status(404).json({message:"User not found"});
    }else if(result.rows[0].role != "student"){
        res.status(403).json({message:"User is not a student"});
    }else{
        res.json(result.rows);
    }
});




app.get("/student_enrolled_courses/:id", async (req, res) => {
    const id = req.params.id;
    const query = `SELECT c.name AS course_name, u.name AS teacher_name FROM Courses c INNER JOIN Teachers t ON t.course_id = c.id INNER JOIN Users u ON u.id = t.user_id WHERE c.id IN (SELECT e.course_id FROM Enrollments e WHERE e.student_id = ${id});`;
    const result = await db.query(query);
    if(result.rows.length === 0){
        res.status(404).json({message:"User not found"});
    }else{
        res.json(result.rows);
    }
});

//add authentication
app.get('/search', async (req, res) => {
    const { keyword, type, courseId, teacherId, startDate, endDate } = req.query;

    try {
        let query = '';
        let values = [keyword || null, courseId || null, teacherId || null, startDate || null, endDate || null];

        // Construct the query dynamically based on the "type" filter
        switch (type) {
            case 'courses':
                query = `
                    SELECT 
                        C.id AS course_id, 
                        C.name AS course_name, 
                        'course' AS type
                    FROM 
                        Courses C
                    WHERE 
                        ($1::TEXT IS NULL OR C.name ILIKE '%' || $1::TEXT || '%');
                `;
                values = [keyword || null];
                break;

            case 'lectures':
                query = `
                    SELECT
                        L.id AS lecture_id, 
                        L.title AS lecture_title, 
                        C.name AS course_name, 
                        U.name AS teacher_name, 
                        L.created_at, 
                        'lecture' AS type
                    FROM 
                        Lectures L
                    INNER JOIN 
                        Courses C ON L.course_id = C.id
                    INNER JOIN 
                        Teachers T ON L.teacher_id = T.id
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR L.title ILIKE '%' || $1::TEXT || '%') 
                        AND ($2::INTEGER IS NULL OR C.id = $2::INTEGER)
                        AND ($3::INTEGER IS NULL OR U.id = $3::INTEGER)
                        AND ($4::TIMESTAMP IS NULL OR L.created_at >= $4::TIMESTAMP)
                        AND ($5::TIMESTAMP IS NULL OR L.created_at <= $5::TIMESTAMP);
                `;
                break;

            case 'teachers':
                query = `
                    SELECT 
                        U.id AS teacher_id, 
                        U.name AS teacher_name, 
                        'teacher' AS type
                    FROM 
                        Teachers T
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR U.name ILIKE '%' || $1::TEXT || '%');
                `;
                values = [keyword || null];
                break;

            default:
                // Default: Search across all types
                query = `
                    SELECT 
                        C.id AS id, 
                        C.name AS name, 
                        'course' AS type
                    FROM 
                        Courses C
                    WHERE 
                        ($1::TEXT IS NULL OR C.name ILIKE '%' || $1::TEXT || '%')
                    
                    UNION ALL
                    
                    SELECT 
                        L.id AS id, 
                        L.title AS name, 
                        'lecture' AS type
                    FROM 
                        Lectures L
                    INNER JOIN 
                        Courses C ON L.course_id = C.id
                    INNER JOIN 
                        Teachers T ON L.teacher_id = T.id
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR L.title ILIKE '%' || $1::TEXT || '%') 
                        AND ($2::INTEGER IS NULL OR C.id = $2::INTEGER)
                        AND ($3::INTEGER IS NULL OR U.id = $3::INTEGER)
                        AND ($4::TIMESTAMP IS NULL OR L.created_at >= $4::TIMESTAMP)
                        AND ($5::TIMESTAMP IS NULL OR L.created_at <= $5::TIMESTAMP)
                    
                    UNION ALL
                    
                    SELECT 
                        U.id AS id, 
                        U.name AS name, 
                        'teacher' AS type
                    FROM 
                        Teachers T
                    INNER JOIN 
                        Users U ON T.user_id = U.id
                    WHERE 
                        ($1::TEXT IS NULL OR U.name ILIKE '%' || $1::TEXT || '%');
                `;
                break;
        }

        const result = await db.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Error executing query', error);
        res.status(500).send('Server error');
    }
});

app.get('/get-user-data', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const query = `SELECT name,email FROM Users WHERE id = ${userId}`;
    const query2 = `SELECT 
                    c.id AS course_id,
                    c.name AS course_name,
                    t.name AS teacher_name
                FROM 
                    enrollments e
                INNER JOIN 
                    courses c ON e.course_id = c.id
                INNER JOIN 
                    users t ON e.teacher_id = t.id
                where e.student_id = ${userId}`;
    const result = await db.query(query);
    const result2 = await db.query(query2);
    res.json({name:result.rows[0].name, email:result.rows[0].email ,courses:result2.rows});
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

    // Get current password hash
    const userResult = await db.query('SELECT password_hash FROM Users WHERE id = $1', [userId]);
    const currentHash = userResult.rows[0].password_hash;

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, currentHash);
    if (!isValidPassword) {
        return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    // Update password
    const query = `UPDATE Users SET password_hash = $1 WHERE id = $2`;
    const result = await db.query(query, [newHash, userId]);
    res.status(200).json({message:"Password changed successfully"});
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
    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT id, email, role, password_hash FROM Users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log("Invalid username or password");
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // implement hashing
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            console.log("Invalid username or password");
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Generate JWT
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

        res.json({ accessToken , role:user.role});
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Server error');
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