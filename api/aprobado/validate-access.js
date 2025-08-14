export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Allow both GET and POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Get token from query or body
        const token = req.query.token || req.body?.token;
        
        if (!token) {
            return res.status(400).json({ 
                success: false, 
                error: 'Token required' 
            });
        }
        
        // Call proxy for validation
        const proxyUrl = `https://cyberix.me.uk/api-proxy.php?action=validate_user&database=aprobadoexpress&token=${token}`;
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        
        return res.status(200).json(data);
        
    } catch (error) {
        console.error('Validate access error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}
