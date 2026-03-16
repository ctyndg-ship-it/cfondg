FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache tzdata

ENV TZ=Asia/Ho_Chi_Minh
ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p /app/logs /app/backups /app/database/data /app/reports/output

COPY .env.production /app/.env

EXPOSE 3000

CMD ["node", "index.js", "dashboard"]
