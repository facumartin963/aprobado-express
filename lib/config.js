// lib/config.js - Configuración centralizada para todos los proyectos

const dbConfigs = {
  aprobado: {
    host: 'cyberix.me.uk',
    database: 'cyberixm_aprobadoexpress',
    user: 'cyberixm_aprobadox',
    password: 'Yse963@@!!',
    port: 3306,
    ssl: false,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    charset: 'utf8mb4'
  },
  ciudadania: {
    host: 'cyberix.me.uk',
    database: 'cyberixm_ciudadaniaexpress',
    user: 'cyberixm_ciudadaniax',
    password: 'Yse963@@!!',
    port: 3306,
    ssl: false,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    charset: 'utf8mb4'
  },
  lifeinuk: {
    host: 'cyberix.me.uk',
    database: 'cyberixm_lifeinuk',
    user: 'cyberixm_lifeinukx',
    password: 'Yse963@@!!',
    port: 3306,
    ssl: false,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    charset: 'utf8mb4'
  }
};

const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  priceIds: {
    aprobado: 'price_1QQaLhP1jZOZUKXSzxHVQOkQ',     // €24.99
    ciudadania: 'price_1QQaLiP1jZOZUKXS3DvQpMcY',  // €29.99
    lifeinuk: 'price_1QQaLjP1jZOZUKXSyBcNvXlM'      // £24.99
  }
};

const projectConfigs = {
  aprobado: {
    name: 'Aprobado Express',
    domain: 'aprobado.express',
    currency: 'EUR',
    price: 24.99,
    language: 'es',
    successUrl: 'https://aprobado.express/dashboard',
    cancelUrl: 'https://aprobado.express',
    examQuestions: 30,
    passScore: 90 // 27/30 preguntas correctas
  },
  ciudadania: {
    name: 'Ciudadanía Express',
    domain: 'ciudadania.express', 
    currency: 'EUR',
    price: 29.99,
    language: 'es',
    successUrl: 'https://ciudadania.express/dashboard',
    cancelUrl: 'https://ciudadania.express',
    examQuestions: 25,
    passScore: 60 // 15/25 preguntas correctas
  },
  lifeinuk: {
    name: 'Life in UK Express',
    domain: 'lifeinuk.express',
    currency: 'GBP', 
    price: 24.99,
    language: 'en',
    successUrl: 'https://lifeinuk.express/dashboard',
    cancelUrl: 'https://lifeinuk.express',
    examQuestions: 24,
    passScore: 75 // 18/24 preguntas correctas
  }
};

// Detectar proyecto desde la URL
function detectProjectFromUrl(url) {
  if (url.includes('aprobado')) return 'aprobado';
  if (url.includes('ciudadania')) return 'ciudadania';
  if (url.includes('lifeinuk')) return 'lifeinuk';
  return null;
}

// Validar configuración al inicio
function validateConfig() {
  const requiredEnvVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

module.exports = {
  dbConfigs,
  stripeConfig,
  projectConfigs,
  detectProjectFromUrl,
  validateConfig
};
