FROM node:20-alpine

# Create and change to the app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the dist folder, node_modules, dockerfile.yml, package.json, and package-lock.json
RUN npm run build

COPY . .

ENV PORT=5000
# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "run", "serve"]