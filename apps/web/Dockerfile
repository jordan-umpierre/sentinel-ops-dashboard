FROM node:22-alpine

WORKDIR /app

# Use the lockfile in containers so installs match local and CI builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
