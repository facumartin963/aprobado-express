// api/aprobado/get-questions.js - Obtener preguntas para práctica

const { Auth } = require('../../lib/auth.js');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, category, limit = 10, difficulty, mode = 'practice' } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token requerido'
      });
    }

    console.log(`📝 Getting questions for Aprobado Express, category: ${category}, limit: ${limit}, mode: ${mode}`);

    const auth = new Auth('aprobado');
    const user = await auth.validateAccess(token);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Ajustar límite según el modo
    let questionLimit = limit;
    if (mode === 'exam_simulation') {
      questionLimit = 30; // Examen oficial DGT
    } else if (mode === 'quick_practice') {
      questionLimit = 10;
    }

    const questions = await auth.getQuestions(category, questionLimit, difficulty);
    
    // No devolver la respuesta correcta en modo práctica/examen
    const questionsForClient = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      category: q.category,
      difficulty: q.difficulty,
      // Solo incluir respuesta correcta en modo review
      ...(mode === 'review' ? { 
        correct_answer: q.correct_answer,
        explanation: q.explanation 
      } : {})
    }));

    console.log(`✅ Retrieved ${questionsForClient.length} questions for user: ${user.email}`);
    
    res.status(200).json({
      success: true,
      questions: questionsForClient,
      mode: mode,
      total_count: questionsForClient.length
    });

  } catch (error) {
    console.error('❌ Error getting questions (aprobado):', error.message);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
