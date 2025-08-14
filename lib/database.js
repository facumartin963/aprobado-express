// lib/database.js - Conexión vía HTTP proxy

const https = require('https');

class Database {
  constructor(project) {
    this.project = project;
    this.proxyUrl = 'https://cyberix.me.uk/api-proxy.php';
  }

  async makeRequest(action, data = {}) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        project: this.project,
        action: action,
        ...data
      });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log(`🌐 Making HTTP request to proxy for ${this.project}, action: ${action}`);

      const req = https.request(this.proxyUrl, options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseBody);
            
            if (res.statusCode === 200 && result.success) {
              console.log(`✅ HTTP request successful for ${this.project}, action: ${action}`);
              resolve(result);
            } else {
              console.error(`❌ HTTP request failed for ${this.project}:`, result);
              reject(new Error(result.error || `HTTP ${res.statusCode}`));
            }
          } catch (parseError) {
            console.error(`❌ JSON parse error for ${this.project}:`, parseError.message);
            console.error(`Response body:`, responseBody);
            reject(new Error(`Invalid JSON response: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`❌ HTTP request error for ${this.project}:`, error.message);
        reject(error);
      });

      req.setTimeout(30000, () => {
        console.error(`❌ HTTP request timeout for ${this.project}`);
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  async testConnection() {
    try {
      console.log(`Testing HTTP connection for ${this.project}...`);
      const result = await this.makeRequest('test');
      
      return {
        success: true,
        result: result.result,
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
      console.log(`Getting stats for ${this.project}...`);
      const result = await this.makeRequest('stats');
      
      return {
        project: this.project,
        questions: result.questions,
        users: result.users,
        sessions: result.sessions,
        categories: result.categories
      };
    } catch (error) {
      console.error(`❌ Stats query failed for ${this.project}:`, error.message);
      throw error;
    }
  }

  async validateUser(token) {
    try {
      console.log(`Validating user for ${this.project}...`);
      const result = await this.makeRequest('validate_user', { token });
      
      return result.user || null;
    } catch (error) {
      console.error(`❌ User validation failed for ${this.project}:`, error.message);
      return null;
    }
  }

  async getQuestions(category = null, limit = 10, difficulty = null) {
    try {
      console.log(`Getting questions for ${this.project}, category: ${category}, limit: ${limit}`);
      const result = await this.makeRequest('get_questions', { 
        category, 
        limit, 
        difficulty 
      });
      
      return result.questions || [];
    } catch (error) {
      console.error(`❌ Get questions failed for ${this.project}:`, error.message);
      throw error;
    }
  }

  // Métodos de compatibilidad con la interfaz anterior
  async query(sql, params = []) {
    // Este método ya no se usa directamente, pero mantenemos compatibilidad
    throw new Error('Direct SQL queries not supported in proxy mode. Use specific methods instead.');
  }
}

module.exports = { Database };
