# Build context is the repository root (it needs server/src for the modules shared with the player API).
FROM node:22-bookworm-slim AS ui
WORKDIR /workspace/admin/ui
COPY admin/ui/package*.json ./
RUN npm ci
COPY admin/ui/ ./
RUN npm run build

FROM node:22-bookworm-slim AS build
WORKDIR /workspace/admin
COPY admin/package*.json ./
RUN npm ci
COPY admin/tsconfig.json ./
COPY admin/src ./src
COPY server/package.json /workspace/server/package.json
COPY server/src /workspace/server/src
# The shared server modules resolve their packages by walking up from /workspace/server/src.
RUN ln -s /workspace/admin/node_modules /workspace/node_modules
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
WORKDIR /workspace/admin
COPY --from=build --chown=node:node /workspace/admin/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/admin/dist ./dist
COPY --from=ui --chown=node:node /workspace/admin/ui/dist ./dist/admin/ui/dist
COPY --chown=node:node admin/package.json ./
USER node
EXPOSE 4000
CMD ["node", "dist/admin/src/main.js"]
