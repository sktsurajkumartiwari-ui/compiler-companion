FROM alpine:3.21
RUN apk add --no-cache g++ && addgroup -S runner && adduser -S runner -G runner
USER runner
WORKDIR /workspace
