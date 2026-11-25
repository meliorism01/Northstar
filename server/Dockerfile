# ============================================================================
# Stage 1: Build Application with Java 21 LTS & Maven Wrapper
# ============================================================================
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace/server

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src src
RUN ./mvnw clean package -DskipTests -B

# ============================================================================
# Stage 2: Minimal Hardened Java 21 JRE Runtime
# ============================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

RUN addgroup -S ordexa && adduser -S ordexa -G ordexa
USER ordexa:ordexa

COPY --from=builder /workspace/server/target/ordexa-server-*.jar /app/app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${SERVER_PORT:-8080}/api/v1/health || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
