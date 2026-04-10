const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// JSON 미들웨어
app.use(express.json());

// MySQL 연결 설정
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// 1. DB 연결 로그 확인
db.connect((err) => {
    if (err) {
        console.error('❌ MySQL 연결 실패:', err.message);
        return;
    }
    console.log('✅ MySQL 데이터베이스 연결 성공! (Dr_Node_DB)');
});

// 2. 서버 실행 로그 확인
app.listen(port, () => {
    console.log(`🚀 서버가 http://localhost:${port} 에서 가동 중입니다.`);
});