# Build context = repo root (so apps/, db/, and data/ are available).
FROM node:22-slim AS web-build
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api ./
COPY db /app/db
COPY data /app/data
COPY --from=web-build /app/apps/web/dist /app/apps/web/dist
ENV PORT=4000 NODE_ENV=production
EXPOSE 4000
CMD ["npx", "tsx", "src/index.ts"]
