const express = require('express');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT = 5001;
const SECRET_KEY = 'minha_chave_secreta_super_segura'; 
const USERS_FILE = './users.json';

function getUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

app.post('/users/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const users = getUsers();
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password: hashedPassword,
        role: role || 'user'
    };

    users.push(newUser);
    saveUsers(users);

    res.status(201).json({ message: 'Usuário criado com sucesso!', id: newUser.id });
});

app.post('/users/login', async (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ error: 'Senha incorreta.' });
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: '1h' }
    );

    res.json({ message: 'Login bem-sucedido', token });
});

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; 
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

app.get('/users/:id', verifyToken, (req, res) => {
    const requestedId = req.params.id;
    const loggedId = req.user.userId;

    if (requestedId !== loggedId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado.' });
    }

    const users = getUsers();
    const user = users.find(u => u.id === requestedId);

    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

app.listen(PORT, () => {
    console.log(`Serviço de Usuários rodando na porta ${PORT}`);
});