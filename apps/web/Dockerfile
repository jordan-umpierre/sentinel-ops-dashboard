FROM node:22-alpine

WORKDIR /app

# Installing from package.json keeps the first Docker iteration simple. A lockfile
# will be committed after dependencies are installed during local validation.
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
