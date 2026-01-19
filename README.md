# Project Transform

Enterprise-grade form platform with:
- Drag & drop form designer
- Offline-first mobile & web apps
- Workflow automation
- AI-powered analytics and agentic workflows

## Tech Stack
- Admin: Next.js
- Mobile: React Native + Web
- Backend: NestJS
- Database: PostgreSQL
- AI: Amazon Bedrock / OpenAI (later)

Commands:
- npm run dev
- npm run start
- node prisma/seed.ts
- npm run prisma:generate
- npx prisma migrate dev -n add_admin_users
- node -e "require('argon2').hash('Admin123!').then(h => console.log(h))"