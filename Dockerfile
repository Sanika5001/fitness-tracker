# Stage 1: Build the C++ binary
FROM gcc:13 AS builder
WORKDIR /build
COPY backend/ ./backend/
RUN g++ -std=c++17 -O2 -pthread -static-libstdc++ -static-libgcc backend/main.cpp -o server

# Stage 2: Minimal runtime image
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /build/server ./server
COPY frontend/ ./frontend/
RUN mkdir -p data/users
ENV PORT=10000
EXPOSE 10000
CMD ["./server"]
