# Use bare Debian Bookworm Slim
FROM debian:bookworm-slim
# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
# 1. Install Prerequisites
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*
# 2. Install Node.js 25 (Latest)
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_25.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs && \
    npm install -g npm@latest
# 3. Install Build Tools & Linux Packaging Requirements (Snap/AppImage/Deb/RPM)
RUN apt-get install -y --no-install-recommends \
    build-essential \
    graphicsmagick \
    rpm \
    dpkg-dev \
    fakeroot \
    libfuse2 \
    libarchive-tools \
    libsecret-1-dev \
    libgl1-mesa-dev \
    git \
    python3 \
    python3-pip \
    dbus \
    dbus-x11 \
    snapd \
    zip \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
CMD ["/bin/bash"]