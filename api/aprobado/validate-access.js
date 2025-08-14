// api/aprobado/validate-access.js - Validar acceso de usuario

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
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token requerido' 
      });
    }

    console.log(`🔑 Validating access for Aprobado Express, token: ${token.substring(0, 8)}...`);

    const auth = new Auth('aprobado');
    const user = await auth.validateAccess(token);

    if (user) {
      // Actualizar último login si es necesario
      try {
        await auth.updateLastLogin(user.id);
      } catch (loginError) {
        console.log(`⚠️ Could not update last login: ${loginError.message}`);
      }
      
      // Obtener progreso del usuario
      let progress;
      try {
        progress = await auth.getUserProgress(user.id);
      } catch (progressError) {
        console.log(`⚠️ Could not get user progress: ${progressError.message}`);
        progress = {
          general: { total_questions: 0, correct_answers: 0, average_score: 0 },
          categories: []
        };
      }
      
      console.log(`✅ Access validated for user: ${user.email}`);
      
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          subscription_status: user.subscription_status,
          exam_attempts: user.exam_attempts || 0,
          best_score: user.best_score || 0,
          total_questions_answered: user.total_questions_answered || 0
        },
        progress: progress
      });
    } else {
      console.log(`❌ Invalid token for Aprobado Express`);
      res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

  } catch (error) {
    console.error('❌ Error validating access (aprobado):', error.message);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
