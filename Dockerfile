# Base image on node
FROM node:14

# Create app directory and move into it
WORKDIR /usr/src/app

# Copy all files into container
COPY . .

# Install packages
RUN npm install

# Expose port
EXPOSE 80

# Run the app
CMD [ "node", "index.js" ]
