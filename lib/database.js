// lib/database.js - Conexión MySQL con túnel SSH

const mysql = require('mysql2/promise');
const { Client } = require('ssh2');
const { dbConfigs } = require('./config.js');

class Database {
  constructor(project) {
    this.project = project;
    this.config = dbConfigs[project];
    this.sshConnection = null;
    
    if (!this.config) {
      throw new Error(`Invalid project: ${project}`);
    }
  }

  async createSSHTunnel() {
    return new Promise((resolve, reject) => {
      const ssh = new Client();
      
      ssh.on('ready', () => {
        console.log(`✅ SSH connection ready for ${this.project}`);
        
        ssh.forwardOut(
          '127.0.0.1', // source host
          0, // source port (0 = auto)
          'localhost', // destination host (localhost en el servidor)
          3306, // destination port (MySQL en el servidor)
          (err, stream) => {
            if (err) {
              console.error(`❌ SSH tunnel error for ${this.project}:`, err);
              reject(err);
              return;
            }
            
            console.log(`✅ SSH tunnel created for ${this.project}`);
            resolve({ ssh, stream });
          }
        );
      });
      
      ssh.on('error', (err) => {
        console.error(`❌ SSH connection error for ${this.project}:`, err);
        reject(err);
      });
      
      // Conectar por SSH usando las credenciales cPanel
      ssh.connect({
        host: this.config.host, // cyberix.me.uk o 192.250.234.56
        port: 22,
        username: this.config.sshUser || 'cyberixm', // Usuario cPanel
        password: this.config.sshPassword || 'tu_password_cpanel', // Password cPanel
        readyTimeout: 30000
      });
    });
  }

  async getConnection() {
    try {
      // Intentar conexión directa primero
      console.log(`Attempting direct connection to ${this.project}...`);
      
      const directConfig = {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        charset: 'utf8mb4',
        ssl: false,
        connectTimeout: 10000, // Reducido para fallar rápido
        acquireTimeout: 10000,
        timeout: 10000
      };

      try {
        const connection = await mysql.createConnection(directConfig);
        console.log(`✅ Direct connection successful for ${this.project}`);
        return connection;
      } catch (directError) {
        console.log(`❌ Direct connection failed for ${this.project}: ${directError.message}`);
        console.log(`🔄 Trying SSH tunnel...`);
        
        // Si falla, intentar con túnel SSH
        const { ssh, stream } = await this.createSSHTunnel();
        this.sshConnection = ssh;
        
        const tunnelConfig = {
          stream: stream,
          user: this.config.user,
          password: this.config.password,
          database: this.config.database,
          charset: 'utf8mb4'
        };
        
        const connection = await mysql.createConnection(tunnelConfig);
        console.log(`✅ SSH tunnel connection successful for ${this.project}`);
        return connection;
      }
      
    } catch (error) {
      console.error(`❌ All connection methods failed for ${this.project}:`, error.message);
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
      console.error(`Query failed for ${this.project}:`, error.message);
      throw error;
    } finally {
      if (connection) {
        await connection.end();
      }
      if (this.sshConnection) {
        this.sshConnection.end();
        this.sshConnection = null;
      }
    }
  }

  async testConnection() {
    try {
      console.log(`Testing connection for ${this.project}...`);
      const result = await this.query('SELECT 1 as test, NOW() as timestamp');
      console.log(`✅ Connection test successful for ${this.project}`);
      return {
        success: true,
        result: result[0],
        project: this.project
      };
    } catch (error) {
      console.error(`❌ Connection test failed for ${this.project}:`, error.message);
      return {
        success: false,
        error: error.message,
        project: this.project
      };
    }
  }

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
      console.error(`Stats query failed for ${this.project}:`, error.message);
      throw error;
    }
  }
}

module.exports = { Database };
