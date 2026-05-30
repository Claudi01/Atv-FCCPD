const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// Configuração dos nossos microsserviços
const services = {
    users: { url: 'http://localhost:5001', status: 'up', failures: 0 },
    products: { url: 'http://localhost:5002', status: 'up', failures: 0 },
    orders: { url: 'http://localhost:5003', status: 'up', failures: 0 }
};

// --- 3. DETECÇÃO DE FALHA POR HEARTBEAT (Requisito Obrigatório) ---
setInterval(async () => {
    for (const [name, service] of Object.entries(services)) {
        try {
            // Tenta acessar a rota /health de cada serviço
            await axios.get(`${service.url}/health`, { timeout: 2000 });
            
            if (service.status === 'down') {
                console.log(`[${new Date().toLocaleTimeString()}] [RECUPERAÇÃO] Serviço de ${name} voltou a responder.`);
            }
            service.failures = 0;
            service.status = 'up';
            
        } catch (error) {
            service.failures += 1;
            // Se falhar 2 vezes seguidas, declara como morto (down)
            if (service.failures >= 2 && service.status === 'up') {
                service.status = 'down';
                console.log(`[${new Date().toLocaleTimeString()}] [FALHA] Serviço de ${name} parou de responder!`);
            }
        }
    }
}, 5000); // Roda a cada 5 segundos exatos


// --- ROTEAMENTO E API GATEWAY ---
app.use(async (req, res) => {
    const path = req.originalUrl;
    let targetService = null;

    // Descobre para onde a requisição deve ir
    if (path.startsWith('/users')) targetService = 'users';
    else if (path.startsWith('/products')) targetService = 'products';
    else if (path.startsWith('/orders')) targetService = 'orders';
    else return res.status(404).json({ error: 'Rota não encontrada no API Gateway.' });

    const service = services[targetService];

    // Tolerância a falhas: se o serviço caiu, retorna o erro 503 imediatamente
    if (service.status === 'down') {
        return res.status(503).json({ 
            error: `Serviço de ${targetService} temporariamente indisponível. (503 Service Unavailable)` 
        });
    }

    try {
        // Repassa a requisição como um "carteiro"
        const response = await axios({
            method: req.method,
            url: `${service.url}${path}`,
            data: req.body,
            headers: {
                // Repassa o crachá de segurança (JWT) para os serviços internos
                Authorization: req.headers.authorization || ''
            }
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: `Erro interno no gateway ao contatar ${targetService}.` });
        }
    }
});

app.listen(PORT, () => {
    console.log(`API Gateway rodando na porta ${PORT} (Porta de entrada única!)`);
    console.log('Monitoramento de Heartbeat iniciado...');
});