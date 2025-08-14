import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { email, product = 'aprobado' } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email required' 
            });
        }
        
        // Product price mapping
        const priceIds = {
            'aprobado': 'price_1QQaLhP1jZOZUKXSzxHVQOkQ',
            'ciudadania': 'price_1QQaLiP1jZOZUKXS3DvQpMcY', 
            'lifeinuk': 'price_1QQaLjP1jZOZUKXSyBcNvXlM'
        };
        
        const priceId = priceIds[product];
        if (!priceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid product' 
            });
        }
        
        // Create or get customer
        let customer;
        const existingCustomers = await stripe.customers.list({ email });
        
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({ email });
        }
        
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            mode: 'payment',
            success_url: `https://aprobado.express/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://aprobado.express/cancel`,
            metadata: {
                product: product,
                email: email
            }
        });
        
        return res.status(200).json({
            success: true,
            session_id: session.id,
            checkout_url: session.url
        });
        
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}
