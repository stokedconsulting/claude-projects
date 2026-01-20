# Monitoring & Health Checks

This document describes the monitoring and health check endpoints available in the State Tracking API.

## Table of Contents

- [Health Check Endpoints](#health-check-endpoints)
- [Kubernetes Probes](#kubernetes-probes)
- [System Metrics](#system-metrics)
- [Metrics Collection](#metrics-collection)
- [CloudWatch Integration](#cloudwatch-integration)
- [Alerting Strategy](#alerting-strategy)
- [Performance Thresholds](#performance-thresholds)

## Health Check Endpoints

The API provides multiple health check endpoints designed for different monitoring scenarios.

### Basic Health Check

**Endpoint:** `GET /health`

Returns the basic health status of the application.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:45.123Z",
  "uptime": 3600,
  "database": "connected",
  "latency": 15
}
```

**Use case:** Simple liveness checks, basic monitoring dashboards

---

## Kubernetes Probes

The API implements Kubernetes-style health probes for container orchestration.

### Readiness Probe

**Endpoint:** `GET /health/ready`

Indicates whether the application is ready to accept traffic. The application is considered ready when:
- MongoDB connection is established
- Required modules are initialized
- Application can process requests

**Response (Ready):**
```json
{
  "ready": true,
  "timestamp": "2024-01-20T10:30:45.123Z",
  "database": "connected"
}
```

**Response (Not Ready):**
```json
{
  "ready": false,
  "timestamp": "2024-01-20T10:30:45.123Z",
  "database": "disconnected"
}
```

**HTTP Status:**
- 200 OK if ready
- 503 Service Unavailable if not ready

**Kubernetes Configuration:**
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

### Liveness Probe

**Endpoint:** `GET /health/live`

Indicates whether the application process is alive and responsive. Unlike the readiness probe, this doesn't check dependencies.

**Response:**
```json
{
  "alive": true,
  "timestamp": "2024-01-20T10:30:45.123Z",
  "uptime": 3600
}
```

**HTTP Status:** Always 200 if the process is running

**Kubernetes Configuration:**
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## Detailed Health Check

**Endpoint:** `GET /health/detailed`

Provides comprehensive health information including system metrics, resource usage, and detailed health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:45.123Z",
  "uptime": 3600,
  "database": {
    "status": "connected",
    "latency": 15
  },
  "metrics": {
    "uptime": 3600,
    "memoryUsage": {
      "heapUsed": 256,
      "heapTotal": 512,
      "external": 8,
      "rss": 350,
      "percentage": 50.0
    },
    "cpuUsage": {
      "user": 1250,
      "system": 320
    },
    "activeSessionCount": 24,
    "errorRate": 0.5,
    "averageResponseTime": 125.5,
    "databaseLatency": 15,
    "version": "0.1.0"
  },
  "checks": {
    "memory": "ok",
    "database": "ok",
    "responseTime": "ok"
  }
}
```

**Status Values:**
- `ok` - All systems healthy
- `degraded` - One or more thresholds approaching limits
- `unhealthy` - Critical thresholds exceeded or dependencies unavailable

**Use case:** Detailed monitoring, dashboard visualization, alerting decisions

---

## System Information

**Endpoint:** `GET /health/system`

Returns system and Node.js runtime information.

**Response:**
```json
{
  "uptime": 3600,
  "nodeVersion": "v20.10.6",
  "platform": "darwin",
  "arch": "arm64",
  "cpus": 8,
  "totalMemory": 16384,
  "freeMemory": 8192,
  "heapUsed": 256,
  "heapTotal": 512,
  "external": 8,
  "rss": 350
}
```

**Memory Values:** All values are in megabytes (MB)

**Use case:** System diagnostics, capacity planning, performance analysis

---

## System Metrics

The API collects the following system metrics:

### Memory Metrics

- **heapUsed**: JavaScript heap memory currently in use (MB)
- **heapTotal**: Total JavaScript heap memory available (MB)
- **external**: Native C++ objects bound to JavaScript objects (MB)
- **rss**: Resident Set Size - total memory allocated to the process (MB)
- **percentage**: Heap usage percentage

### CPU Metrics

- **user**: CPU time spent in user code (milliseconds)
- **system**: CPU time spent in system calls (milliseconds)

### Application Metrics

- **uptime**: Seconds since process started
- **activeSessionCount**: Number of active, paused, or stalled sessions
- **errorRate**: Percentage of requests that resulted in errors
- **averageResponseTime**: Mean response time in milliseconds
- **databaseLatency**: Time taken for database ping (milliseconds)
- **version**: Application version

---

## Metrics Collection

The `MetricsService` automatically collects metrics throughout application execution:

### Request Tracking

```typescript
// Recorded by logging interceptor
metrics.recordRequest();      // Increment request counter
metrics.recordError();         // Increment error counter
metrics.recordResponseTime(ms); // Track response time
```

### Accessing Metrics

```typescript
const avgTime = metricsService.getAverageResponseTime();
const p95Time = metricsService.getP95ResponseTime();
const p99Time = metricsService.getP99ResponseTime();
const errorRate = metricsService.getErrorRate();
const memory = metricsService.getMemoryMetrics();
const cpu = metricsService.getCpuMetrics();
```

### Resetting Metrics

Metrics can be reset for a new collection period:

```typescript
metricsService.resetMetrics();
```

This is useful for calculating metrics per time window.

---

## Performance Thresholds

### Memory Health Checks

| Threshold | Status | Action |
|-----------|--------|--------|
| < 75% | ok | Normal operation |
| 75-90% | warning | Monitor closely |
| > 90% | critical | Alert and investigate |

### Database Latency Checks

| Latency | Status | Action |
|---------|--------|--------|
| < 500ms | ok | Normal operation |
| 500-1000ms | warning | Monitor closely |
| > 1000ms | critical | Alert and investigate |

### Response Time Checks

| Average Time | Status | Action |
|--------------|--------|--------|
| < 1000ms | ok | Normal operation |
| 1000-2000ms | warning | Monitor closely |
| > 2000ms | critical | Alert and investigate |

### Overall Health Status

The overall health status is determined by:

| Condition | Status |
|-----------|--------|
| Database disconnected | unhealthy |
| Any metric at critical level | unhealthy |
| Any metric at warning level | degraded |
| All metrics healthy | ok |

---

## CloudWatch Integration

### Configuration

The API supports publishing custom metrics to AWS CloudWatch. Enable via environment variable:

```bash
CLOUDWATCH_ENABLED=true
CLOUDWATCH_NAMESPACE=claude-projects
CLOUDWATCH_REGION=us-east-1
```

### Published Metrics

When enabled, the `/health/detailed` endpoint automatically publishes:

- **ActiveSessionCount** - Number of active sessions (Count)
- **ErrorRate** - Percentage of failed requests (Percent)
- **AverageResponseTime** - Mean request response time (Milliseconds)

### Metric Publication Frequency

Metrics are published at most once per 60 seconds, even if `/health/detailed` is called more frequently. This reduces API costs while maintaining adequate data resolution.

### CloudWatch Namespace

All metrics are published under the configured namespace (default: `claude-projects`) with dimensions:

- `Environment` - deployment environment (dev/staging/production)
- `Service` - service name (state-tracking-api)

### Example CloudWatch Query

```
fields @timestamp, @message
| stats avg(AverageResponseTime), max(ErrorRate), sum(ActiveSessionCount) by Environment
```

---

## Alerting Strategy

### Recommended Alerts

#### Critical Alerts

1. **Readiness Probe Failed**
   - Condition: `/health/ready` returns 503
   - Action: Page on-call engineer

2. **High Memory Usage**
   - Condition: Memory usage > 90% for 5 minutes
   - Action: Page on-call engineer, consider scaling

3. **Database Unavailable**
   - Condition: Database latency > 10s or disconnected
   - Action: Page on-call engineer, activate incident response

4. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Action: Alert engineering team

#### Warning Alerts

1. **Elevated Response Times**
   - Condition: Average response time > 2000ms for 5 minutes
   - Action: Create alert ticket

2. **Memory Usage Rising**
   - Condition: Memory usage > 75% for 10 minutes
   - Action: Create alert ticket

3. **Slow Database Queries**
   - Condition: Database latency > 500ms for 10 minutes
   - Action: Create alert ticket

### Alert Rules Example (CloudWatch)

```json
{
  "AlarmName": "state-tracking-api-high-memory",
  "MetricName": "MemoryUsagePercent",
  "Namespace": "claude-projects",
  "Statistic": "Average",
  "Period": 300,
  "EvaluationPeriods": 1,
  "Threshold": 90,
  "ComparisonOperator": "GreaterThanThreshold",
  "TreatMissingData": "notBreaching"
}
```

---

## Dashboard Visualization

### Recommended Dashboard Layout

1. **Status Overview**
   - Latest health status (OK/Degraded/Unhealthy)
   - Last health check time
   - System uptime

2. **Resource Utilization**
   - Memory usage (%), displayed as gauge
   - CPU time (user/system)
   - Active session count

3. **Performance Metrics**
   - Average response time (line chart)
   - P95 and P99 response times
   - Error rate (%)

4. **Database Health**
   - Database connection status
   - Database latency (milliseconds)
   - Ping response time trend

5. **Session Metrics**
   - Active sessions count
   - Sessions by status
   - Session creation rate

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "State Tracking API Health",
    "panels": [
      {
        "title": "Memory Usage",
        "targets": [
          {
            "metrics": ["MemoryUsagePercent"],
            "stat": "Average"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "metrics": ["AverageResponseTime"],
            "stat": "Average"
          }
        ]
      }
    ]
  }
}
```

---

## Monitoring Best Practices

### Collection Interval

- **Liveness Probe**: Every 10 seconds (minimal overhead)
- **Readiness Probe**: Every 10-30 seconds
- **Detailed Health**: Every 60 seconds (heavier computation)
- **System Info**: On demand only

### Handling Cascading Failures

If the database becomes unavailable:

1. Readiness probe returns 503 immediately
2. New requests are rejected until database recovers
3. Existing connections remain open for graceful shutdown
4. Alerts trigger for database team

### Memory Leak Detection

1. Monitor heap size trend over time
2. If heap grows without stabilizing, memory leak likely present
3. Trigger full garbage collection test
4. If heap continues growing, restart service

### Performance Degradation

1. Correlate response time increase with:
   - Memory usage increase
   - Database latency increase
   - Error rate increase
2. Check for common causes:
   - Long-running queries
   - Memory leaks
   - Database connection pool exhaustion
   - High concurrent load

---

## Troubleshooting

### High Memory Usage

**Symptoms:**
- Memory percentage > 85%
- Response times increasing
- Garbage collection pauses visible

**Steps:**
1. Check for active memory leaks using heap dump
2. Review recent code changes for object allocations
3. Consider increasing heap size limit
4. Scale horizontally if load-related

### Slow Database Responses

**Symptoms:**
- Database latency > 500ms
- /health/detailed returns degraded status

**Steps:**
1. Check MongoDB connection pool status
2. Monitor MongoDB server load
3. Review slow query logs
4. Consider query optimization or indexing

### High Error Rate

**Symptoms:**
- Error rate > 2%
- Multiple alert triggers
- /health/detailed shows degraded status

**Steps:**
1. Check application logs for error patterns
2. Review recent deployments
3. Check downstream service availability
4. Monitor error rate trend

### Readiness Probe Failing

**Symptoms:**
- /health/ready returns 503
- Kubernetes may restart pods

**Steps:**
1. Check MongoDB connection string
2. Verify network connectivity to MongoDB
3. Check MongoDB server status
4. Review application initialization logs

---

## See Also

- [Error Handling](./ERROR_HANDLING.md)
- [Session Health Endpoints](./SESSION_HEALTH_ENDPOINTS.md)
- [Deployment Guide](./DEPLOYMENT.md)
