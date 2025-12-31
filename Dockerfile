FROM ubuntu:24.04
# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
# Update and install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    graphicsmagick \
    rpm \
    dpkg-dev \
    fakeroot \
    libfuse2 \
    libarchive-tools \
    libsecret-1-dev \
    libgl1-mesa-dev \
    flatpak \
    flatpak-builder \
    dbus \
    dbus-x11 \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    file \
    desktop-file-utils \
    udev \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*
# Create python symlink (python -> python3)
RUN ln -s /usr/bin/python3 /usr/bin/python
# Install Node.js 25
RUN curl -fsSL https://deb.nodesource.com/setup_25.x | bash - && \
    apt-get install -y nodejs
# Verify installations
RUN node -v && npm -v && python --version
# Set working directory
WORKDIR /app
# By default, start a bash shell
CMD ["/bin/bash"]