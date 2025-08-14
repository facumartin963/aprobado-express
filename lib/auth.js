// lib/auth.js - Sistema de autenticación unificado

import { Database } from './database.js';
import crypto from 'crypto';

export class Auth {
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

  async saveAnswer(userId, sessionId, questionId, selectedAnswer, isCorrect, timeSpent) {
    const sql = `
      INSERT INTO user_answers (user_id, session_id, question_id, selected_answer, is_correct, time_spent_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await this.db.query(sql, [userId, sessionId, questionId, selectedAnswer, isCorrect, timeSpent]);
    
    // Actualizar estadísticas del usuario
    await this.updateUserStats(userId);
    
    return result;
  }

  async createSession(userId, sessionType) {
    const sql = `
      INSERT INTO practice_sessions (user_id, session_type)
      VALUES (?, ?)
    `;
    
    const result = await this.db.query(sql, [userId, sessionType]);
    return result.insertId;
  }

  async updateSession(sessionId, questionsAnswered, correctAnswers, completed = false) {
    const scorePercentage = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0;
    
    const sql = `
      UPDATE practice_sessions 
      SET questions_answered = ?, correct_answers = ?, score_percentage = ?, 
          completed = ?, completed_at = ${completed ? 'NOW()' : 'NULL'}
      WHERE id = ?
    `;
    
    await this.db.query(sql, [questionsAnswered, correctAnswers, scorePercentage, completed, sessionId]);
  }

  async updateUserStats(userId) {
    // Actualizar estadísticas generales del usuario
    const sql = `
      UPDATE users SET 
        total_questions_answered = (
          SELECT COUNT(*) FROM user_answers WHERE user_id = ?
        ),
        best_score = (
          SELECT COALESCE(MAX(score_percentage), 0) 
          FROM practice_sessions 
          WHERE user_id = ? AND completed = 1
        )
      WHERE id = ?
    `;
    
    await this.db.query(sql, [userId, userId, userId]);
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
    
    // Sesiones recientes
    const sessionsSql = `
      SELECT session_type, score_percentage, questions_answered, correct_answers, 
             DATE(completed_at) as date
      FROM practice_sessions 
      WHERE user_id = ? AND completed = 1 
      ORDER BY completed_at DESC 
      LIMIT 10
    `;
    
    const recentSessions = await this.db.query(sessionsSql, [userId]);
    
    return {
      general: generalStats[0] || { total_questions: 0, correct_answers: 0, average_score: 0 },
      categories: categoryStats,
      recent_sessions: recentSessions
    };
  }

  async getCategories() {
    const sql = 'SELECT DISTINCT category FROM questions ORDER BY category';
    const results = await this.db.query(sql);
    return results.map(row => row.category);
  }

  // Método para verificar si el usuario puede tomar el examen
  async canTakeExam(userId) {
    const sql = `
      SELECT COUNT(*) as exam_count
      FROM practice_sessions 
      WHERE user_id = ? AND session_type = 'exam_simulation' 
      AND DATE(started_at) = CURDATE()
    `;
    
    const result = await this.db.query(sql, [userId]);
    const todayExams = result[0].exam_count;
    
    // Limitar a 3 exámenes por día
    return todayExams < 3;
  }

  // Método para obtener preguntas específicas para examen
  async getExamQuestions(userId) {
    // Obtener preguntas que el usuario ha respondido menos veces
    const sql = `
      SELECT q.*, COALESCE(answer_count, 0) as times_answered
      FROM questions q
      LEFT JOIN (
        SELECT question_id, COUNT(*) as answer_count
        FROM user_answers 
        WHERE user_id = ?
        GROUP BY question_id
      ) ua ON q.id = ua.question_id
      ORDER BY times_answered ASC, RAND()
      LIMIT 30
    `;
    
    return await this.db.query(sql, [userId]);
  }
}
