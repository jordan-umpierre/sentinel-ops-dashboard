# Dev-only image: runs the Vite dev server with HMR for local docker-compose work.
# Production deploys go to Vercel (see vercel.json + README); do not deploy this
# Dockerfile as-is — it intentionally does not produce a static build.
FROM node:22-alpine

WORKDIR /app

# Use the lockfile in containers so installs match local and CI builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
