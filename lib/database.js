// lib/database.js - Conexión MySQL optimizada para Vercel

import mysql from 'mysql2/promise';
import { dbConfigs } from './config.js';

export class Database {
  constructor(project) {
    this.project = project;
    this.config = dbConfigs[project];
    
    if (!this.config) {
      throw new Error(`Invalid project: ${project}`);
    }
  }

  async getConnection() {
    try {
      const connection = await mysql.createConnection({
        ...this.config,
        connectTimeout: 60000,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4'
      });
      
      return connection;
    } catch (error) {
      console.error(`Database connection failed for ${this.project}:`, error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async query(sql, params = []) {
    let connection;
    try {
      connection = await this.getConnection();
      const [results] = await connection.execute(sql, params);
      return results;
    } catch (error) {
      console.error(`Query failed for ${this.project}:`, error);
      console.error(`SQL: ${sql}`);
      console.error(`Params: ${JSON.stringify(params)}`);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  async testConnection() {
    try {
      const result = await this.query('SELECT 1 as test, NOW() as timestamp');
      return {
        success: true,
        result: result[0],
        project: this.project
      };
    } catch (error) {
      console.error(`Connection test failed for ${this.project}:`, error);
      return {
        success: false,
        error: error.message,
        project: this.project
      };
    }
  }

  // Método para obtener estadísticas de la base de datos
  async getStats() {
    try {
      const [questionCount] = await this.query('SELECT COUNT(*) as count FROM questions');
      const [userCount] = await this.query('SELECT COUNT(*) as count FROM users');
      const [sessionCount] = await this.query('SELECT COUNT(*) as count FROM practice_sessions');
      
      const categoryStats = await this.query(`
        SELECT category, COUNT(*) as count 
        FROM questions 
        GROUP BY category 
        ORDER BY category
      `);

      return {
        project: this.project,
        questions: questionCount.count,
        users: userCount.count,
        sessions: sessionCount.count,
        categories: categoryStats
      };
    } catch (error) {
      console.error(`Stats query failed for ${this.project}:`, error);
      throw error;
    }
  }
}
