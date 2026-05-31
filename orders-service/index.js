const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Para comunicar com o serviço de produtos

const app = express();
app.use(express.json());

const PORT = 5003;
const SECRET_KEY = 'minha_chave_secreta_super_segura'; 
const ORDERS_FILE = './orders.json';

// Funções para ler e salvar pedidos
function getOrders() {
    try {
        const data = fs.readFileSync(ORDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveOrders(orders) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// Middleware de autenticação JWT para usuários em geral
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // Salva os dados do usuário do token (userId, role)
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

// 1. Health Check (Obrigatório para o Gateway)
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// 2. Criar um pedido (Requer JWT)
app.post('/orders', verifyToken, async (req, res) => {
    const { productId, quantity } = req.body;
    
    // A mágica do JWT: Não precisamos pedir o ID do usuário no body, 
    // nós pegamos direto da "identidade" comprovada pelo Token!
    const userId = req.user.userId; 

    if (!productId || !quantity) {
        return res.status(400).json({ error: 'productId e quantity são obrigatórios.' });
    }

    try {

        const productResponse = await axios.get(`http://localhost:5002/products/${productId}`);
        const product = productResponse.data;

        const orders = getOrders();
        
        // Monta o recibo do pedido
        const newOrder = {
            id: Date.now().toString(),
            userId: userId,
            product: {
                id: product.id,
                name: product.name,
                price: product.price
            },
            quantity: quantity,
            totalPrice: product.price * quantity,
            status: 'Aprovado'
        };

        orders.push(newOrder);
        saveOrders(orders);

        res.status(201).json({ message: 'Pedido realizado com sucesso!', order: newOrder });

    } catch (error) {
        // Se o axios retornar erro 404, o produto não existe lá no 5002
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: 'Produto não encontrado no catálogo.' });
        }
        res.status(500).json({ error: 'Erro de comunicação com o Serviço de Produtos.' });
    }
});

// 3. Listar pedidos de um usuário (Requer JWT)
app.get('/orders/:userId', verifyToken, (req, res) => {
    const requestedUserId = req.params.userId;
    const loggedUserId = req.user.userId;

    // Segurança: Um usuário normal só pode ver os próprios pedidos
    if (requestedUserId !== loggedUserId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }

    const orders = getOrders();
    const userOrders = orders.filter(o => o.userId === requestedUserId);

    res.json(userOrders);
});

app.listen(PORT, () => {
    console.log(`Serviço de Pedidos rodando na porta ${PORT}`);
});