require('dotenv').config();
const express = require('express');
const mariadb = require('mariadb');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// 1. MariaDB 연결 설정
const pool = mariadb.createPool({
    host: '127.0.0.1', 
    user: 'root',
    password: 'root1234', 
    database: 'dr_mas_db',
    connectionLimit: 5
});

// 2. Gemini AI 초기화 (발급받으신 새 키 적용)
const genAI = new GoogleGenerativeAI('AIzaSyAhSRRoBVFTk3Zju-9horOxh4cFzVgCHcc');

app.post('/api/chat', async (req, res) => {
    const { userId, symptomText, userLat, userLng } = req.body;

    try {
        const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY;

        // --- 구역 1: 질병 API 호출 (JSON 응답 방식 적용 완료) ---
        let diseaseData = "현재 질병 데이터 서버 통신 지연으로 AI 기본 지식을 활용합니다.";
        try {
            const diseaseUrl = `http://apis.data.go.kr/B551182/diseaseInfoService1/getDissNameCodeList1?serviceKey=${PUBLIC_API_KEY}&pageNo=1&numOfRows=3&sickType=1&medTp=1&diseaseType=SICK_NM&searchText=${encodeURIComponent(symptomText)}&_type=json`;
            const diseaseResponse = await axios.get(diseaseUrl);
            
            // XML 파싱 없이 바로 JSON 데이터 저장
            diseaseData = diseaseResponse.data;
            console.log("✅ 질병 API 데이터 로드 성공!");
        } catch (apiError) {
            console.log("⚠️ 질병 API 호출 건너뜀 (원인:", apiError.message, ")");
        }

        // --- 구역 2: 병원 API 호출 (팀장님이 확인한 최신 v2 엔드포인트 적용) ---
        let hospitalData = "주변 병원 정보를 가져올 수 없습니다.";
        if (userLat && userLng) {
            try {
                const hospitalUrl = `https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList?serviceKey=${PUBLIC_API_KEY}&pageNo=1&numOfRows=5&xPos=${userLng}&yPos=${userLat}&radius=3000&_type=json`;
                const hospitalResponse = await axios.get(hospitalUrl);
                hospitalData = hospitalResponse.data;
                console.log("✅ 병원 API 데이터 로드 성공!");
            } catch (apiError) {
                console.log("⚠️ 병원 API 호출 건너뜀 (원인:", apiError.message, ")");
            }
        }

        // --- 구역 3: Gemini 분석 (유일하게 인식 성공한 모델명 유지) ---
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `너는 노인 맞춤형 AI 의료 비서 'Dr. MAS'야. 제공된 자료를 바탕으로 [사용자 증상]: "${symptomText}"에 대해 분석해줘.
        어르신이 이해하기 쉬운 따뜻한 말투를 사용해.
        [질병정보]: ${JSON.stringify(diseaseData)}
        [주변병원]: ${JSON.stringify(hospitalData)}
        응답은 무조건 JSON 형식으로만 해: {"predictedDisease": "질환명", "guide": "행동지침"}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // AI가 보내주는 불필요한 마크다운 기호 제거 후 JSON 변환
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
        const aiResult = JSON.parse(cleanJson);

        console.log(`[Dr. MAS 분석 완료]:`, aiResult);

        // --- 구역 4: DB 저장 및 응답 ---
        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO symptom_logs (user_id, symptom_text, ai_predicted_disease, ai_guide) VALUES (?, ?, ?, ?)`,
            [userId || 1, symptomText, aiResult.predictedDisease, aiResult.guide]
        );
        conn.release();

        res.json({ success: true, data: aiResult });

    } catch (err) {
        console.error("챗봇 에러 발생:", err);
        res.status(500).json({ success: false, message: "분석 중 오류 발생" });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Dr. MAS 백엔드 서버가 ${PORT}번 포트에서 가동 중입니다!`));
