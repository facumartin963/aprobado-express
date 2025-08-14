// api/aprobado/create-checkout.js - Crear checkout con Stripe

const { stripeConfig, projectConfigs } = require('../../lib/config.js');

// Importar Stripe solo si está disponible
let stripe;
try {
  const Stripe = require('stripe');
  stripe = new Stripe(stripeConfig.secretKey);
} catch (error) {
  console.error('Stripe not available:', error.message);
}

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

  if (!stripe) {
    return res.status(500).json({ 
      success: false, 
      error: 'Stripe not configured' 
    });
  }

  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email válido requerido' 
      });
    }

    const config = projectConfigs.aprobado;

    console.log(`🛒 Creating checkout for Aprobado Express: ${email}`);

    // Crear o recuperar customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log(`👤 Found existing customer: ${customer.id}`);
    } else {
      customer = await stripe.customers.create({
        email: email,
        metadata: {
          project: 'aprobado',
          created_via: 'api'
        }
      });
      console.log(`👤 Created new customer: ${customer.id}`);
    }

    // Crear checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: stripeConfig.priceIds.aprobado,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${config.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: config.cancelUrl,
      metadata: {
        project: 'aprobado',
        user_email: email,
        created_via: 'api'
      },
      billing_address_collection: 'auto',
      automatic_tax: {
        enabled: true,
      }
    });

    console.log(`✅ Checkout session created: ${session.id}`);

    res.status(200).json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      customer_id: customer.id
    });

  } catch (error) {
    console.error('❌ Error creating checkout (aprobado):', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
