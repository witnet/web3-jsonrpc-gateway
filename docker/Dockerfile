FROM node:20-bookworm

ARG TARGETPLATFORM

# Install dependencies not included in the base image
RUN apt update && apt upgrade -y
RUN apt install bash ca-certificates curl git openssh-client

# Update CA certificates
RUN update-ca-certificates

# Check out latest release of this repository
RUN mkdir /data
COPY . /data

# Navigate to the nodejs root package, install dependencies and build the project
WORKDIR /data
RUN corepack enable && corepack prepare yarn@4.5.3 --activate

# Subroutine for arm64 platform
RUN if [ "$TARGETPLATFORM" = "linux/amd64" ]; then \
        echo "Current platform linux/amd64"; \
        yarn; \
        yarn build; \
    elif [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        echo "Current platform linux/arm64"; \
        apt install build-essential; \
        yarn global add node-gyp; \
        yarn; \
        yarn build; \
    else \
        echo "Unsupported platform: $TARGETPLATFORM"; \
        exit 1; \
    fi

RUN chmod +x dist/bin/*

# Set the entrypoint and main command
# Runs the default Infura gateway, but CMD can be overriden when running a container so it runs the reactions monitor server
ENTRYPOINT ["npx"]
CMD ["ethrpc-infura"]
