FROM ghcr.io/puppeteer/puppeteer:22.12.1

ENV PUPPERTEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "index.js"]

