FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o licenseserver .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /data
COPY --from=builder /app/licenseserver /usr/local/bin/licenseserver
# SQLite database is persisted in /data via a mounted volume
VOLUME ["/data"]
ENV DB_PATH=/data/bough-licenses.db
EXPOSE 8080
CMD ["licenseserver"]
