# Build context = repo root (so db/ and data/ are available): docker compose build api
FROM node:22-slim
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api ./
COPY db /app/db
COPY data /app/data
# If Person C's web build exists at apps/web/dist the API serves it (single Render service).
COPY apps/web/dist* /app/apps/web/dist/
ENV PORT=4000 NODE_ENV=production
EXPOSE 4000
CMD ["npx", "tsx", "src/index.ts"]
