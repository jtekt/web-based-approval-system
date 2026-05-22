FROM node:24-slim AS builder
WORKDIR /usr/src/app
COPY package*.json tsconfig.json .mocharc.yml ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:24-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE 80
CMD ["node", "dist/index.js"]
