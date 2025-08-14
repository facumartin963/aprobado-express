// lib/auth.js - Sistema de autenticación vía HTTP proxy

const { Database } = require('./database.js');
const crypto = require('crypto');

class Auth {
  constructor(project) {
    this.db = new Database(project);
    this.project = project;
  }

  async validateAccess(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    try {
      const user = await this.db.validateUser(token);
      return user;
    } catch (error) {
      console.error(`❌ Access validation failed for ${this.project}:`, error.message);
      return null;
    }
  }

  async createUser(email, stripeCustomerId, stripePaymentId) {
    // Esta función requiere insertar datos, necesitamos agregar al proxy
    const accessToken = crypto.randomBytes(32).toString('hex');
    
    // Por ahora devolvemos el token, pero necesitaremos implementar 
    // create_user en el proxy PHP
    console.log(`📝 User creation needed for ${email} in ${this.project}`);
    console.log(`🔑 Generated token: ${accessToken}`);
    
    return accessToken;
  }

  async updateLastLogin(userId) {
    // Implementar en proxy si es necesario
    console.log(`📝 Last login update needed for user ${userId} in ${this.project}`);
  }

  async getQuestions(category = null, limit = 10, difficulty = null) {
    try {
      return await this.db.getQuestions(category, limit, difficulty);
    } catch (error) {
      console.error(`❌ Get questions failed for ${this.project}:`, error.message);
      throw error;
    }
  }

  async getQuestionById(questionId) {
    // Implementar en proxy si es necesario
    throw new Error('getQuestionById not implemented in proxy mode yet');
  }

  async getUserProgress(userId) {
    // Implementar en proxy si es necesario
    console.log(`📊 User progress needed for user ${userId} in ${this.project}`);
    
    // Devolver datos dummy por ahora
    return {
      general: { total_questions: 0, correct_answers: 0, average_score: 0 },
      categories: []
    };
  }

  async getCategories() {
    try {
      const stats = await this.db.getStats();
      return stats.categories.map(cat => cat.category);
    } catch (error) {
      console.error(`❌ Get categories failed for ${this.project}:`, error.message);
      return [];
    }
  }
}

module.exports = { Auth };
