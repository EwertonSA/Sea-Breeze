FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

RUN npx playwright install --with-deps chromium

COPY . .

CMD ["npx", "jest", "--runInBand", "tests/"]