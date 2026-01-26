FROM node:20-alpine

WORKDIR /app

# Install required packages
RUN npm install express axios jsonwebtoken

# Copy the API server
COPY api-server.js .

EXPOSE 3001

CMD ["node", "api-server.js"]
