const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT = 5001;
const SECRET_KEY = 'minha_chave_secreta_super_segura'; 
const USERS_FILE = './users.json';

// Função auxiliar para ler usuários do JSON
function getUsers() {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
}

// Função auxiliar para salvar usuários no JSON
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 1. Health Check (Requisito obrigatório para o Gateway)
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// 2. Registro de Usuário
app.post('/users/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    const users = getUsers();

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    // Hash da senha (segurança)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password: hashedPassword,
        role: role || 'user' // 'user' ou 'admin'
    };

    users.push(newUser);
    saveUsers(users);

    res.status(201).json({ message: 'Usuário criado com sucesso!', id: newUser.id });
});

// 3. Login e geração de JWT
app.post('/users/login', async (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Senha incorreta.' });
    }

    // Gerando o Token com os dados do usuário
    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: '1h' }
    );

    res.json({ token });
});

// 4. Retornar dados do usuário (Requer JWT)
app.get('/users/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        // Regra: só pode ver se for o dono do ID ou um admin
        if (decoded.userId !== req.params.id && decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        const users = getUsers();
        const user = users.find(u => u.id === req.params.id);
        
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        // Removemos a senha antes de devolver os dados
        const { password, ...userData } = user;
        res.json(userData);
        
    } catch (err) {
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
});

app.listen(PORT, () => {
    console.log(`Serviço de Usuários rodando na porta ${PORT}`);
});