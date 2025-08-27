FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i
COPY index.html vite.config.js ./ 
COPY public ./public
COPY src ./src
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
