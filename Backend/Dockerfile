FROM node:20-slim

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Expose API port
EXPOSE 3000

# Start system with the bootstrap logic
CMD [ "node", "index.js" ]