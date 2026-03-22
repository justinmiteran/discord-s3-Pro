FROM node:20-slim AS builder

WORKDIR /usr/src/app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build

# ---

FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY config.cfg ./

EXPOSE 3000

CMD [ "node", "dist/src/index.js" ]