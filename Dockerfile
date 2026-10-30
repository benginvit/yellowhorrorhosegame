# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Staging builds (--build-arg STAGING=true) are marked noindex; default is off
ARG STAGING=false
RUN if [ "$STAGING" = "true" ]; then \
      sed -i 's#<head>#<head><meta name="robots" content="noindex">#' dist/index.html && \
      grep -q 'name="robots"' dist/index.html; \
    fi

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
