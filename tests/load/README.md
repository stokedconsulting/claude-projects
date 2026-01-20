# Load Testing

This directory contains load tests for the Claude Projects State Tracking API.

## Overview

The load tests validate that the API meets production performance requirements:
- **Read operations:** < 500ms response time
- **Write operations:** < 2s response time
- **Concurrent clients:** 50+ simultaneous connections
- **Sustained load:** 1000 operations/hour
- **Error rate:** < 1%

## Prerequisites

Install k6 load testing tool:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or download from https://k6.io/docs/get-started/installation/
```

## Running Load Tests

### Basic Load Test

Run with default configuration (10 VUs, 5 minutes):

```bash
cd /path/to/project
k6 run tests/load/load-test.js
```

### Custom Configuration

Override test parameters via environment variables:

```bash
# Test against staging environment
API_BASE_URL=https://staging.claude-projects.truapi.com \
API_KEY=your-staging-api-key \
k6 run tests/load/load-test.js

# Custom load profile
LOAD_TEST_VUS=50 \
LOAD_TEST_DURATION=10m \
k6 run tests/load/load-test.js

# Production validation (50 VUs, 1 hour)
API_BASE_URL=https://claude-projects.truapi.com \
API_KEY=your-production-api-key \
LOAD_TEST_VUS=50 \
LOAD_TEST_DURATION=60m \
k6 run tests/load/load-test.js
```

### Cloud Load Testing

Run tests from k6 Cloud for distributed load:

```bash
k6 cloud tests/load/load-test.js
```

## Test Scenarios

The load test includes several scenarios:

### 1. Health Checks
- Lightweight endpoint monitoring
- Target: < 200ms response time
- Validates service availability

### 2. Session Lifecycle
- Create session
- Send heartbeat
- Get session details
- Update session status
- Validates primary use case

### 3. Task Operations
- Create task
- Get task details
- Validates task tracking

### 4. List Operations
- List sessions with filters
- Validates pagination and query performance

## Performance Thresholds

The test automatically validates:

| Metric | Threshold | Requirement |
|--------|-----------|-------------|
| Read operations (p95) | < 500ms | Production SLA |
| Write operations (p95) | < 2s | Production SLA |
| Heartbeat (p95) | < 1s | Critical path |
| Error rate | < 1% | Reliability target |
| Check success rate | > 99% | Overall success |

## Interpreting Results

### Successful Test Output

```
     ✓ health check status 200
     ✓ create session status 201
     ✓ heartbeat status 200
     ...

     checks.........................: 99.50% ✓ 1990 ✗ 10
     errors.........................: 0.50%  ✓ 10   ✗ 1990
     http_req_duration..............: avg=245ms min=50ms med=200ms max=1.2s p(95)=450ms
     read_operation_duration........: avg=180ms min=45ms med=150ms max=480ms p(95)=350ms
     write_operation_duration.......: avg=850ms min=200ms med=700ms max=1.8s p(95)=1.5s
```

### Failed Test Output

```
     ✗ create session < 2s
     ✗ read operations p95 < 500ms

     checks.........................: 95.00% ✓ 1900 ✗ 100
     errors.........................: 5.00%  ✓ 100  ✗ 1900
     read_operation_duration........: avg=650ms p(95)=1.2s  ✗ FAILED
```

## Load Test Types

### 1. Smoke Test
Quick validation that system works under minimal load:
```bash
k6 run --vus 1 --duration 1m tests/load/load-test.js
```

### 2. Load Test
Validate normal expected load:
```bash
k6 run --vus 10 --duration 10m tests/load/load-test.js
```

### 3. Stress Test
Find system breaking point:
```bash
k6 run --vus 100 --duration 10m tests/load/load-test.js
```

### 4. Spike Test
Test sudden traffic spikes:
```bash
k6 run tests/load/load-test.js \
  --stage 0s:0,10s:100,1m:100,10s:0
```

### 5. Soak Test
Extended duration for memory leaks:
```bash
k6 run --vus 50 --duration 24h tests/load/load-test.js
```

## Continuous Integration

Add to CI/CD pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: |
          curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
          sudo mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin
      - name: Run load test
        env:
          API_BASE_URL: ${{ secrets.STAGING_API_URL }}
          API_KEY: ${{ secrets.STAGING_API_KEY }}
        run: k6 run tests/load/load-test.js
```

## Troubleshooting

### High Error Rate
- Check API logs for errors
- Verify database connection pool size
- Check rate limiting configuration
- Verify network connectivity

### Slow Response Times
- Check database query performance
- Verify database indexes
- Check Lambda cold starts
- Monitor CPU/memory usage

### Connection Failures
- Check concurrent connection limits
- Verify API Gateway throttling
- Check MongoDB connection pool
- Verify network timeouts

## References

- [k6 Documentation](https://k6.io/docs/)
- [Production Readiness Checklist](../../docs/production-readiness-checklist.md)
- [API Reference](../../docs/api-reference.md)
