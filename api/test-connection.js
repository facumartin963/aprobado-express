// api/test-connection.js - Endpoint para testing de conexiones

import { Database } from '../lib/database.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results = {};
  const projects = ['aprobado', 'ciudadania', 'lifeinuk'];

  console.log('Testing database connections...');

  for (const project of projects) {
    try {
      console.log(`Testing ${project}...`);
      const db = new Database(project);
      
      // Test básico de conexión
      const connectionTest = await db.testConnection();
      
      if (connectionTest.success) {
        // Obtener estadísticas
        const stats = await db.getStats();
        
        results[project] = {
          status: 'connected',
          connection_time: connectionTest.result.timestamp,
          ...stats
        };
        
        console.log(`✅ ${project}: ${stats.questions} questions, ${stats.users} users`);
      } else {
        results[project] = {
          status: 'disconnected',
          error: connectionTest.error
        };
        console.log(`❌ ${project}: ${connectionTest.error}`);
      }
    } catch (error) {
      results[project] = {
        status: 'error',
        error: error.message
      };
      console.log(`💥 ${project}: ${error.message}`);
    }
  }

  // Verificar variables de entorno
  const envCheck = {
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET
  };

  const response = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown',
    env_variables: envCheck,
    database_tests: results,
    summary: {
      total_projects: projects.length,
      connected: Object.values(results).filter(r => r.status === 'connected').length,
      total_questions: Object.values(results).reduce((sum, r) => sum + (r.questions || 0), 0),
      total_users: Object.values(results).reduce((sum, r) => sum + (r.users || 0), 0)
    }
  };

  console.log('Test completed:', response.summary);

  res.status(200).json(response);
}
