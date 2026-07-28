FROM node:20-alpine AS base
WORKDIR /app

RUN addgroup -S dpp && adduser -S dpp -G dpp \
  && apk add --no-cache su-exec

COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build \
  && mkdir -p /app/uploads \
  && chown -R dpp:dpp /app

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
