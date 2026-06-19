FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "src/index.js"]
