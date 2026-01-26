FROM node:24-alpine

# Install security updates
RUN apk upgrade --no-cache

WORKDIR /app

# Copy package files and install dependencies as root
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy application source
COPY src/ ./src/

# Create non-root user and set ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app && \
    mkdir -p /data && \
    chown -R nodejs:nodejs /data

# Switch to non-root user
USER nodejs

ENV NGAUTH_DATA=/data
ENV PORT=3000

VOLUME /data

EXPOSE 3000

CMD ["node", "src/index.js"]
