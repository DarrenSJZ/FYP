FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod ./
COPY go.sum* ./

# Download dependencies and create go.sum
RUN go mod download
RUN go mod tidy

# Copy source code
COPY . .

# Build the application
RUN go build -o autocomplete main.go

# Production image
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/autocomplete .

# Expose port
EXPOSE 8007

# Run the binary
CMD ["./autocomplete"]