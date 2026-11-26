# One Dockerfile, two images (see docker-compose.yml):
#   --target server  the Node game server
#   --target web     Caddy serving the built client (public, HTTPS) and host screen (localhost only)

# ---------- game server ----------
FROM node:22-alpine AS server-build
WORKDIR /app
COPY splendor-web-server/package.json splendor-web-server/package-lock.json ./
RUN npm ci
COPY splendor-web-server/tsconfig.json splendor-web-server/tsconfig.build.json ./
COPY splendor-web-server/src src
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY splendor-web-server/package.json splendor-web-server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=server-build /app/dist dist
COPY splendor-web-server/data data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]

# ---------- Angular apps ----------
FROM node:22-alpine AS web-build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json ./
COPY splendor-web-shared splendor-web-shared
COPY splendor-web-client splendor-web-client
COPY splendor-web-host splendor-web-host
RUN npx ng build client && npx ng build host

FROM caddy:2-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/dist/client/browser /srv/client
COPY --from=web-build /app/dist/host/browser /srv/host
