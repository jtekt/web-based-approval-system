FROM node:24-slim

WORKDIR /usr/src/app

COPY . .

RUN npm install
RUN npm run build

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

CMD ["node", "dist/index.js"]