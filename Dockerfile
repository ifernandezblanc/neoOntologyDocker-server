# Docker Image which is used as foundation to create a custom Docker Image with this Dockerfile
FROM node:10.15-slim

#  Creates a directory in the Docker image
RUN mkdir /server

# Sets the created directory in the Docker image as working directory
WORKDIR /server

# Copies package.json to Docker image working environment
COPY package.json .
COPY package-lock.json .

# Runs command to install all node packages established in package.json
RUN npm install

# Copies everything in this folder over to docker working directory
COPY . .

# Exposes port which is used by the actual application
EXPOSE 3003

# Runs the application by defining the command to do so
CMD [ "node", "neoOntology.js" ]