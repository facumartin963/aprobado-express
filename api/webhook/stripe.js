// api/webhook/stripe.js - Webhook unificado para todos los proyectos

const { stripeConfig } = require('../../lib/config.js');

// Importar Stripe y proxy para crear usuarios
let stripe;
try {
  const Stripe = require('stripe');
  stripe = new Stripe(stripeConfig.secretKey);
} catch (error) {
  console.error('Stripe not available:', error.message);
}

// Función para crear usuario vía proxy
async function createUserViaProxy(project, email, stripeCustomerId, stripePaymentId) {
  const https = require('https');
  const crypto = require('crypto');
  
  const accessToken = crypto.randomBytes(32).toString('hex');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      project: project,
      action: 'create_user',
      email: email,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_id: stripePaymentId,
      access_token: accessToken
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request('https://cyberix.me.uk/api-proxy.php', options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(responseBody);
          if (result.success) {
            resolve(accessToken);
          } else {
            reject(new Error(result.error || 'Failed to create user'));
          }
        } catch (parseError) {
          reject(parseError);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Función para enviar email de acceso
async function sendAccessEmail(email, accessToken, project) {
  const projectNames = {
    aprobado: 'Aprobado Express',
    ciudadania: 'Ciudadanía Express', 
    lifeinuk: 'Life in UK Express'
  };

  const dashboardUrls = {
    aprobado: 'https://aprobado.express/dashboard',
    ciudadania: 'https://ciudadania.express/dashboard',
    lifeinuk: 'https://lifeinuk.express/dashboard'
  };

  const projectName = projectNames[project] || project;
  const dashboardUrl = `${dashboardUrls[project]}?token=${accessToken}`;

  console.log(`📧 Email should be sent to ${email} for ${projectName}`);
  console.log(`🔗 Dashboard URL: ${dashboardUrl}`);
  console.log(`🔑 Access token: ${accessToken}`);

  // TODO: Integrar con servicio de email real (SendGrid, Resend, etc.)
  // Por ahora solo logs para testing
  
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Obtener el body como buffer para verificación de webhook
    let body;
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }
    
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      stripeConfig.webhookSecret
    );
    
    console.log(`📥 Webhook received: ${event.type}`);
    
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        console.log(`💰 Payment succeeded: ${event.data.object.id}`);
        break;
        
      case 'customer.created':
        console.log(`👤 Customer created: ${event.data.object.id}`);
        break;
        
      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function handleCheckoutCompleted(session) {
  try {
    const { customer, metadata, payment_intent, amount_total } = session;
    const project = metadata?.project;
    const userEmail = metadata?.user_email;

    console.log(`🛒 Checkout completed for ${project}: ${userEmail}`);
    console.log(`💰 Amount: ${amount_total} (${session.currency})`);

    if (!project || !userEmail) {
      console.error('❌ Missing metadata in checkout session:', { project, userEmail });
      return;
    }

    // Validar que el proyecto sea válido
    if (!['aprobado', 'ciudadania', 'lifeinuk'].includes(project)) {
      console.error('❌ Invalid project in metadata:', project);
      return;
    }

    console.log(`👤 Creating user for ${project}: ${userEmail}`);

    // Crear usuario en la base de datos correspondiente
    const accessToken = await createUserViaProxy(userEmail, customer, payment_intent, project);

    // Enviar email con acceso
    await sendAccessEmail(userEmail, accessToken, project);
    
    console.log(`✅ User created successfully for ${project}: ${userEmail}`);
    console.log(`🔑 Access token generated: ${accessToken.substring(0, 8)}...`);

  } catch (error) {
    console.error('❌ Error in handleCheckoutCompleted:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Configuración especial para manejar raw body
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
