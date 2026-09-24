FROM node:24-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run build
EXPOSE 80
CMD ["node", "."]
