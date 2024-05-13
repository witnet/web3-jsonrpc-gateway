FROM node:16-alpine3.15

# Install dependencies not included in the base image
RUN apk update
RUN apk upgrade
RUN apk --no-cache add bash ca-certificates curl
RUN apk add --no-cache git
RUN apk add --no-cache openssh-client

# Update CA certificates
RUN update-ca-certificates

# Check out latest release of this repository
RUN mkdir /data
COPY . /data

# Navigate to the nodejs root package, install dependencies and build the project
WORKDIR /data
RUN corepack enable
RUN corepack prepare yarn@3.0.1 --activate
RUN yarn
RUN yarn build
RUN chmod +x dist/bin/*
RUN yarn link

# Set the entrypoint and main command
# Runs the default Infura gateway, but CMD can be overriden when running a container so it runs the reactions monitor server
ENTRYPOINT ["npx"]
CMD ["w3gw-infura"]
