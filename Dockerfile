FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
RUN mkdir -p /app/data
ENV NODE_ENV=production
EXPOSE 30083
CMD ["npm","start"]
