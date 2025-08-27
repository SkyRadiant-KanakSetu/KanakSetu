FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i
COPY src ./src
ENV PORT=${PORT}
EXPOSE 3000
CMD ["node", "src/index.js"]
