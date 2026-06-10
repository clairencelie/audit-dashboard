FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
RUN go mod download

COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o audit-dashboard ./cmd/api

FROM alpine:3.19

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Jakarta

COPY --from=builder /app/audit-dashboard .

RUN mkdir -p /app/uploads

EXPOSE 8080

CMD ["./audit-dashboard"]
