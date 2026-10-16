FROM node:22-bookworm-slim AS build
WORKDIR /workspace/server
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /workspace/server
COPY --from=build --chown=node:node /workspace/server/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/server/dist ./dist
COPY --chown=node:node server/package*.json ./
COPY --chown=node:node server/migrations ./migrations
COPY --chown=node:node app/src/main/assets/levels.json /workspace/app/src/main/assets/levels.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
