FROM mcr.microsoft.com/playwright:v1.65.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json playwright.config.ts ./
COPY src ./src
COPY tests ./tests

ENV CI=true
ENV BASE_URL=https://automationexercise.com

CMD ["npm", "test"]
