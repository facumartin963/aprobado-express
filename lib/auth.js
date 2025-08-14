// lib/auth.js - Sistema de autenticación CommonJS

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

    const sql = `
      SELECT id, email, subscription_status, created_at, last_login,
             exam_attempts, best_score, total_questions_answered
      FROM users 
      WHERE access_token = ? AND subscription_status = 'active'
    `;
    
    const results = await this.db.query(sql, [token]);
    return results[0] || null;
  }

  async createUser(email, stripeCustomerId, stripePaymentId) {
    const accessToken = crypto.randomBytes(32).toString('hex');
    
    const sql = `
      INSERT INTO users (email, stripe_customer_id, stripe_payment_id, access_token, subscription_status) 
      VALUES (?, ?, ?, ?, 'active')
      ON DUPLICATE KEY UPDATE 
        stripe_payment_id = VALUES(stripe_payment_id),
        access_token = VALUES(access_token),
        subscription_status = 'active'
    `;
    
    await this.db.query(sql, [email, stripeCustomerId, stripePaymentId, accessToken]);
    return accessToken;
  }

  async updateLastLogin(userId) {
    const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
    await this.db.query(sql, [userId]);
  }

  async getQuestions(category = null, limit = 10, difficulty = null) {
    let sql = `
      SELECT id, question_text, option_a, option_b, option_c, 
             correct_answer, explanation, category, difficulty 
      FROM questions WHERE 1=1
    `;
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }
    
    sql += ' ORDER BY RAND() LIMIT ?';
    params.push(parseInt(limit));
    
    return await this.db.query(sql, params);
  }

  async getQuestionById(questionId) {
    const sql = 'SELECT * FROM questions WHERE id = ?';
    const results = await this.db.query(sql, [questionId]);
    return results[0] || null;
  }

  async getUserProgress(userId) {
    // Estadísticas generales
    const generalSql = `
      SELECT 
        COUNT(*) as total_questions,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
        ROUND(AVG(CASE WHEN is_correct = 1 THEN 100 ELSE 0 END), 2) as average_score
      FROM user_answers 
      WHERE user_id = ?
    `;
    
    const generalStats = await this.db.query(generalSql, [userId]);
    
    // Progreso por categoría
    const categorySql = `
      SELECT 
        q.category,
        COUNT(*) as questions_answered,
        SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
        ROUND(AVG(CASE WHEN ua.is_correct = 1 THEN 100 ELSE 0 END), 2) as accuracy_percentage
      FROM user_answers ua
      JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ?
      GROUP BY q.category
    `;
    
    const categoryStats = await this.db.query(categorySql, [userId]);
    
    return {
      general: generalStats[0] || { total_questions: 0, correct_answers: 0, average_score: 0 },
      categories: categoryStats
    };
  }

  async getCategories() {
    const sql = 'SELECT DISTINCT category FROM questions ORDER BY category';
    const results = await this.db.query(sql);
    return results.map(row => row.category);
  }
}

module.exports = { Auth };
