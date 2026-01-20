# Observability Validation Tests

This directory contains tests that validate the API's observability capabilities for production readiness.

## Overview

Observability is critical for operating a production API. These tests ensure that:
- Logs are structured and contain required information
- Metrics are collected and exposed correctly
- Health checks provide comprehensive system status
- Sensitive data is properly sanitized
- Error tracking includes actionable information

## Test Suites

### 1. Logging Tests (`logging.test.ts`)

Validates logging requirements:
- **Structured Logging:** JSON format with consistent schema
- **Log Levels:** Proper use of debug, info, warn, error
- **Request Logging:** All requests logged with metadata
- **Error Logging:** Stack traces and context included
- **Sensitive Data:** API keys and credentials sanitized
- **Correlation IDs:** Request tracking across service boundaries

**Run:**
```bash
npm test -- tests/observability/logging.test.ts
```

### 2. Metrics Tests (`metrics.test.ts`)

Validates metrics collection and exposure:
- **Request Metrics:** Count, rate, by endpoint, by method
- **Response Time:** p50, p95, p99 percentiles
- **Error Rates:** 4xx, 5xx, total error percentage
- **Connection Metrics:** Active connections, database pool
- **Business Metrics:** Sessions, heartbeats, stall detection
- **System Metrics:** Uptime, memory, CPU

**Run:**
```bash
npm test -- tests/observability/metrics.test.ts
```

## Production Requirements

### Logging Requirements
From PRD Section 5.4 - Production Readiness:

1. **Structured Logging:**
   - JSON format
   - Consistent schema with timestamp, level, message, context
   - Correlation IDs for request tracing

2. **Log Levels:**
   - `debug`: Detailed diagnostic information (disabled in production)
   - `info`: General informational messages
   - `warn`: Warning messages for concerning but non-error conditions
   - `error`: Error messages with stack traces

3. **Sensitive Data Sanitization:**
   - API keys never logged in plain text
   - Database credentials redacted
   - AWS credentials redacted
   - Automatic scrubbing of sensitive patterns

4. **Request Context:**
   - HTTP method, path, status code, response time
   - User agent, correlation ID
   - Request/response bodies (sanitized)

### Metrics Requirements

1. **Request Metrics:**
   - Total request count
   - Requests per endpoint
   - Requests per HTTP method
   - Requests by status code

2. **Response Time:**
   - Average, p50, p95, p99
   - Read operations: p95 < 500ms
   - Write operations: p95 < 2s

3. **Error Tracking:**
   - Total errors (4xx + 5xx)
   - Error rate percentage
   - Target: < 1% error rate

4. **Business Metrics:**
   - Active sessions count
   - Sessions by status (active, completed, failed, stalled)
   - Heartbeats received
   - Stalled sessions detected
   - Recovery operations performed

### Health Check Requirements

1. **Basic Health Check (`/health`):**
   - Response time < 200ms
   - Returns 200 when service is healthy
   - Simple status: "ok" or "error"

2. **Detailed Health Check (`/health/detailed`):**
   - Response time < 1s
   - Database connectivity and response time
   - Background job status and last run time
   - Uptime, version, timestamp
   - Individual component health

## Running All Observability Tests

```bash
# Run all observability tests
npm test -- tests/observability/

# Run with coverage
npm test -- tests/observability/ --coverage

# Run in watch mode (for development)
npm test -- tests/observability/ --watch
```

## Integration with Monitoring Systems

### CloudWatch Logs
Logs should be shipped to CloudWatch Logs for:
- Centralized log aggregation
- Log retention (30+ days)
- Log querying and filtering
- Alerting on error patterns

### CloudWatch Metrics
Custom metrics should be published to CloudWatch:
- Request count and rate
- Error rate
- Response time percentiles
- Active sessions count
- Stalled sessions detected

### CloudWatch Alarms
Critical alarms:
- Error rate > 5%
- p95 response time > 2s
- Active sessions > threshold
- Health check failures

### Dashboards
Create CloudWatch dashboards for:
- Request volume and patterns
- Response time trends
- Error rates over time
- Session lifecycle metrics
- Database performance

## Validation Checklist

Use this checklist to validate observability before production:

### Logging
- [ ] All requests logged with metadata
- [ ] Errors logged with stack traces
- [ ] Sensitive data automatically sanitized
- [ ] Logs in JSON format
- [ ] Correlation IDs present
- [ ] Log retention configured (30+ days)

### Metrics
- [ ] /metrics endpoint returns all required metrics
- [ ] Response time percentiles calculated
- [ ] Error rate tracked and < 1%
- [ ] Business metrics updated in real-time
- [ ] Metrics exported to CloudWatch

### Health Checks
- [ ] /health returns 200 when healthy
- [ ] /health/detailed includes all components
- [ ] Database health checked
- [ ] Background job health checked
- [ ] Response times meet requirements

### Alerting
- [ ] Error rate alert configured
- [ ] Response time alert configured
- [ ] Health check failure alert configured
- [ ] Database connectivity alert configured
- [ ] On-call rotation configured

### Documentation
- [ ] Monitoring setup documented
- [ ] Dashboard creation documented
- [ ] Alert thresholds documented
- [ ] Runbooks for common alerts

## Troubleshooting

### Logs Not Appearing
1. Check log level configuration (should be `info` or `debug`)
2. Verify CloudWatch Logs permissions
3. Check Lambda execution role has CloudWatch Logs permissions
4. Review log group and stream configuration

### Metrics Not Updating
1. Verify metrics service is running
2. Check metrics calculation logic
3. Verify CloudWatch Metrics permissions
4. Check metrics buffer/flush interval

### Health Checks Failing
1. Check database connectivity
2. Verify background job scheduler
3. Review component health checks
4. Check timeout configuration

### High Response Times
1. Check database query performance
2. Review database indexes
3. Check Lambda cold starts
4. Monitor connection pool usage
5. Review business logic complexity

## References

- [Production Readiness Checklist](../../docs/production-readiness-checklist.md)
- [Security Audit](../../docs/security-audit.md)
- [API Reference](../../docs/api-reference.md)
- [CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [CloudWatch Metrics Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)
