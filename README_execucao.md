# Mini E-commerce Distribuído

Este projeto é uma implementação de um sistema de e-commerce baseado em microsserviços, com API Gateway, autenticação JWT, replicação de dados e detecção de falhas por Heartbeat.

## Pré-requisitos
- [Node.js](https://nodejs.org/) (Versão 18 ou superior)
- Navegador ou ferramenta de testes de API (Postman / Thunder Client)

## Como iniciar o projeto

Para rodar a infraestrutura completa, você precisará abrir **4 terminais diferentes** na raiz do projeto, pois cada microsserviço roda de forma independente.

### Passo 1: Iniciar o Serviço de Usuários (Porta 5001)
No Terminal 1, rode:
\`\`\`bash
cd users-service
node index.js
\`\`\`

### Passo 2: Iniciar o Serviço de Produtos (Porta 5002)
No Terminal 2, rode:
\`\`\`bash
cd products-service
node index.js
\`\`\`

### Passo 3: Iniciar o Serviço de Pedidos (Porta 5003)
No Terminal 3, rode:
\`\`\`bash
cd orders-service
node index.js
\`\`\`

### Passo 4: Iniciar o API Gateway (Porta 5000)
No Terminal 4, rode:
\`\`\`bash
cd api-gateway
node index.js
\`\`\`

## Como Testar
A partir de agora, **todas as requisições** devem ser feitas apenas para a porta do Gateway: \`http://localhost:5000\`.

1. Cadastre um usuário enviando um POST para \`/users/register\`.
2. Faça login com um POST para \`/users/login\` para obter o Token JWT.
3. Use o Token no cabeçalho (\`Authorization: Bearer <token>\`) para testar a criação de produtos (\`/products\`) e pedidos (\`/orders\`).