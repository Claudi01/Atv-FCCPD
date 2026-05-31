const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT = 5002;
const SECRET_KEY = 'minha_chave_secreta_super_segura'; 

const REPLICA_1 = './products_replica1.json';
const REPLICA_2 = './products_replica2.json';

let currentReadReplica = 1;

function getProductsFromReplica() {
    try {
        let fileToRead = currentReadReplica === 1 ? REPLICA_1 : REPLICA_2;
        currentReadReplica = currentReadReplica === 1 ? 2 : 1; 
        
        const data = fs.readFileSync(fileToRead, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveProductsToBothReplicas(products) {
    const data = JSON.stringify(products, null, 2);
    fs.writeFileSync(REPLICA_1, data);
    fs.writeFileSync(REPLICA_2, data);
}

function verifyAdminToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas admins podem criar produtos.' });
        }
        
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

app.get('/products', (req, res) => {
    const products = getProductsFromReplica();
    res.json(products);
});

app.get('/products/:id', (req, res) => {
    const products = getProductsFromReplica();
    const product = products.find(p => p.id === req.params.id);

    if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    res.json(product);
});

app.post('/products', verifyAdminToken, (req, res) => {
    const { name, price, description } = req.body;

    if (!name || !price) {
        return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
    }

    const products = getProductsFromReplica();
    
    const newProduct = {
        id: Date.now().toString(),
        name,
        price,
        description: description || ''
    };

    products.push(newProduct);
    saveProductsToBothReplicas(products);

    res.status(201).json({ message: 'Produto criado com sucesso!', product: newProduct });
});

app.listen(PORT, () => {
    console.log(`Serviço de Produtos rodando na porta ${PORT}`);
});