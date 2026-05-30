const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT = 5002;
// A chave secreta deve ser EXATAMENTE a mesma do serviço de usuários
const SECRET_KEY = 'minha_chave_secreta_super_segura'; 

// Variável global para controlar o Round-Robin (Balanceamento de carga na leitura)
let currentReplica = 1;

// --- FUNÇÕES DE REPLICAÇÃO ---

// LEITURA: Alterna entre a réplica 1 e 2 a cada requisição (Round-Robin)
function readProducts() {
    const file = currentReplica === 1 ? './products_replica1.json' : './products_replica2.json';
    console.log(`[Round-Robin] Lendo os dados da réplica ${currentReplica}`);
    
    // Alterna o valor para a próxima requisição ler da outra réplica
    currentReplica = currentReplica === 1 ? 2 : 1;
    
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
}

// ESCRITA: Consistência Forte - Escreve em AMBAS as réplicas simultaneamente
function saveProductsToReplicas(products) {
    fs.writeFileSync('./products_replica1.json', JSON.stringify(products, null, 2));
    fs.writeFileSync('./products_replica2.json', JSON.stringify(products, null, 2));
    console.log('[Consistência Forte] Produto salvo nas réplicas 1 e 2 com sucesso.');
}

// --- MIDDLEWARE DE SEGURANÇA (JWT) ---
function verifyAdminToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        // Regra da atividade: Apenas 'admin' pode criar produtos
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
        }
        req.user = decoded; // Salva as infos do usuário para uso posterior
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

// --- ROTAS DO SERVIÇO ---

// 1. Health Check (Obrigatório para o Gateway)
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// 2. Listar todos os produtos (Leitura via Round-Robin, qualquer usuário pode ver)
app.get('/products', (req, res) => {
    const products = readProducts();
    res.json(products);
});

// 3. Detalhar um produto específico
app.get('/products/:id', (req, res) => {
    const products = readProducts();
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(product);
});

// 4. Criar produto (Escrita com Consistência Forte, Requer JWT de Admin)
app.post('/products', verifyAdminToken, (req, res) => {
    const { name, price, description } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
    }

    // Lê a base atual (pode ser de qualquer réplica, pois garantimos que são iguais)
    const products = readProducts();
    
    const newProduct = {
        id: Date.now().toString(),
        name,
        price,
        description: description || ''
    };

    products.push(newProduct);
    
    // Salva nas duas réplicas antes de responder ao usuário
    saveProductsToReplicas(products);

    res.status(201).json({ message: 'Produto criado com sucesso!', product: newProduct });
});

app.listen(PORT, () => {
    console.log(`Serviço de Produtos rodando na porta ${PORT}`);
});