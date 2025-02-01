# Use a lightweight Python image
FROM python:3.10-alpine

# Install only minimal dependencies
RUN apk update && apk add --no-cache \
    python3-dev \
    libffi-dev

# Create a non-root user and workspace
RUN adduser -D executor && \
    mkdir -p /app && \
    chown -R executor:executor /app

USER executor
WORKDIR /app

# Copy and install lightweight Python dependencies
COPY --chown=executor:executor requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python execution script
COPY --chown=executor:executor safe_executor.py /app/safe_executor.py

# Default execution command
CMD ["python", "/app/safe_executor.py"]
