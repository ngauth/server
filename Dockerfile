FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

ENV NGAUTH_DATA=/data
ENV PORT=3000

VOLUME /data

EXPOSE 3000

CMD ["node", "src/index.js"]
