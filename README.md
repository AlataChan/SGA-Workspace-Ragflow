# 🚀 SGA Workspace - Enterprise AI Agent Management Platform

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/sologenai/sga-workspace/releases)
[![Docker](https://img.shields.io/badge/docker-ready-green.svg)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**SGA Workspace** is a comprehensive enterprise-grade AI agent management platform that enables organizations to deploy, manage, and interact with multiple AI agents in a unified environment.

## ✨ Key Features

### 🤖 AI Agent Management
- **Multi-Agent Support**: Manage multiple AI agents with different capabilities
- **DIFY Integration**: Seamless integration with DIFY AI platform
- **Real-time Chat**: Interactive chat interface with AI agents
- **Agent Configuration**: Easy setup and configuration of agent parameters

### 🏢 Enterprise Features
- **Multi-tenant Architecture**: Support for multiple companies and departments
- **Role-based Access Control**: Admin, user, and custom role management
- **User Management**: Complete user lifecycle management
- **Company Branding**: Custom logos and company information

### 🐳 Docker-First Architecture
- **Production Ready**: Complete Docker Compose setup
- **Microservices**: nginx, Next.js app, PostgreSQL, Redis
- **Health Monitoring**: Built-in health checks and monitoring
- **Scalable**: Easy horizontal scaling

### 🎨 Modern UI/UX
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Theme**: Adaptive theme support
- **Tailwind CSS**: Modern, utility-first CSS framework
- **TypeScript**: Full type safety and developer experience

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     nginx       │    │   Next.js App   │    │   PostgreSQL    │
│   (Port 8100)   │────│   (Port 3000)   │────│   (Port 5433)   │
│  Load Balancer  │    │   Frontend/API   │    │    Database     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │      Redis      │
                       │   (Port 6380)   │
                       │     Cache       │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### 🐳 One-Click Deployment (Recommended)

#### Linux/macOS:
```bash
git clone https://github.com/sologenai/sga-workspace.git
cd sga-workspace
chmod +x quick-deploy.sh
./quick-deploy.sh
```

#### Windows:
```bash
git clone https://github.com/sologenai/sga-workspace.git
cd sga-workspace
quick-deploy.bat
```

### 📋 Manual Installation

1. **Clone the repository**
```bash
git clone https://github.com/sologenai/sga-workspace.git
cd sga-workspace
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env and modify all "change-this" values
```

3. **Start with Docker**
```bash
docker compose up -d
```

4. **Access the application**
- Main Application: http://localhost:8100
- First-time Setup: Follow the initialization wizard to create admin account

### 🔧 Troubleshooting

For detailed deployment instructions and troubleshooting, see:
- [SETUP.md](./SETUP.md) - Quick deployment guide
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Comprehensive deployment documentation

### Development Setup

1. **Install dependencies**
```bash
npm install
```

2. **Setup database**
```bash
npx prisma generate
npx prisma db push
```

3. **Start development server**
```bash
npm run dev
```

## 📦 Tech Stack

### Frontend
- **Next.js 14.2.5** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives

### Backend
- **Node.js** - JavaScript runtime
- **Prisma** - Next-generation ORM
- **PostgreSQL** - Relational database
- **Redis** - In-memory data store

### Infrastructure
- **Docker** - Containerization
- **nginx** - Reverse proxy and load balancer
- **Sharp** - Image processing

## 🔧 Configuration

### Environment Variables

Key environment variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/ai_workspace

# Authentication
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
TOKEN_ENCRYPTION_KEY=your-64-char-hex-token-encryption-key

# Redis
REDIS_PASSWORD=redis123

# Admin User
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=admin123456

# DIFY Integration
DEFAULT_DIFY_BASE_URL=your-dify-instance-url
```

### Docker Services

- **nginx**: Reverse proxy (Port 8100)
- **app**: Next.js application (Internal port 3000)
- **postgres**: PostgreSQL database (Port 5433)
- **redis**: Redis cache (Port 6380)

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Admin Guide](docs/admin-pages.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@sologenai.com
- 💬 Issues: [GitHub Issues](https://github.com/sologenai/sga-workspace/issues)
- 📖 Documentation: [Wiki](https://github.com/sologenai/sga-workspace/wiki)

## 🎯 Roadmap

- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Plugin system for custom integrations
- [ ] Advanced AI model management
- [ ] Kubernetes deployment support

---

**Made with ❤️ by the SoloGen AI Team**
