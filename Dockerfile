# Production Docker image for template-nodejs-express-mongo
# Multi-stage build: compile TypeScript, then run on a slim Node.js runtime

# Base image with Node.js LTS
FROM node:20-slim AS base
WORKDIR /app

# Install dependencies and build TypeScript
FROM base AS build
COPY package*.json ./
RUN npm install --include=dev



COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production runtime image
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled output
COPY --from=build /app/dist ./dist



# Non-root user for security
USER node

EXPOSE 3030
CMD ["node", "dist/server.js"]
