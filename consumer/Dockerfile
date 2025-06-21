# ---- Builder Stage ----
# This stage installs all dependencies and compiles the TypeScript code.
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm install

# Copy all source code and config files
COPY . .

# Compile TypeScript to JavaScript. The output will be in the /app/dist directory.
RUN npm run build

# ---- Production Stage ----
# This stage creates the final, lean image.
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the compiled JavaScript code from the builder stage
COPY --from=builder /app/dist/src/ ./dist

# Command to run the consumer application
CMD ["node", "dist/index.js"]
