# Circuit Breaker Operations Guide

## Quick Reference

### Check Status

```bash
# All circuit breakers
curl http://localhost:8888/metrics | jq '.circuitBreakers'

# Pretty view
curl http://localhost:8888/metrics | jq '{circuitBreakers: .circuitBreakers}'
```

### Understanding States

| State | Meaning | Action |
|-------|---------|--------|
| **CLOSED** | ✅ Normal | Requests flowing normally |
| **OPEN** | ⛔ Failing | Requests rejected (fail-fast) |
| **HALF_OPEN** | 🔄 Testing | Limited requests to test recovery |

### Common Scenarios

#### Scenario 1: Backend Service Down
```
Time  Event                                   Action
---   -----                                   ------
t0    Backend goes offline
t1    Requests to backend fail (5 times)
t2    Circuit breaker → OPEN                  Check why backend failed
t3    New requests rejected immediately       Investigate backend logs
t4    (Wait 30 seconds)                       
t5    Circuit breaker → HALF_OPEN             Limited requests allowed
t6    If backend recovered → CLOSED           ✅ Service back online
      If backend still down → OPEN again      ⛔ Continue troubleshooting
```

#### Scenario 2: High Latency / Slow Responses
```
Circuit detects:
- Requests taking too long
- Exceeding timeout threshold
- Failure count increases
- Circuit opens
- Prevents cascading impact

Result: Clients get fast error response instead of hanging
```

### Response Format

**When Circuit is CLOSED:**
```json
{
  "result": {...}  // Normal response
}
```

**When Circuit is OPEN:**
```json
{
  "error": {
    "code": -32603,
    "message": "Circuit breaker for \"journey\" is OPEN. Service unavailable."
  }
}
```

### Metrics Details

```json
{
  "circuitBreakers": {
    "journey": {
      "state": "CLOSED",           // Current state
      "failureCount": 0,           // Recent failures
      "successCount": 2,           // Successes in HALF_OPEN
      "isHealthy": true            // Overall health
    }
  }
}
```

## Operations Checklist

### Daily Monitoring
- [ ] Check `/metrics` endpoint for circuit states
- [ ] Verify all circuits are CLOSED (or HALF_OPEN is transitioning)
- [ ] Monitor error rates
- [ ] Check backend health status

### When Circuit Opens

1. **Immediate (t+0)**
   ```bash
   # Verify circuit is open
   curl http://localhost:8888/metrics | jq '.circuitBreakers.journey'
   
   # Check backend status
   curl http://localhost:8888/health | jq '.backends[] | select(.id=="journey")'
   ```

2. **Investigation (t+5min)**
   - Check backend service logs
   - Verify backend is running
   - Check network connectivity
   - Review recent changes

3. **Resolution (t+30s+)**
   - Fix the underlying issue
   - Circuit will automatically attempt recovery
   - Monitor HALF_OPEN transition

### Configuration Tuning

Default thresholds (in `main.ts`):
```typescript
{
  failureThreshold: 5,      // Opens after 5 failures
  successThreshold: 2,      // Closes after 2 successes
  timeout: 30000,           // Recovery attempt after 30s
  monitorWindow: 60000      // Count failures in 60s window
}
```

To adjust (modify `main.ts` and redeploy):
```typescript
circuitBreaker.execute(async () => {
  // Increase timeout for slower backends:
  return circuitBreakerRegistry.getOrCreate(server.id, {
    failureThreshold: 3,      // More sensitive
    timeout: 60000,           // Longer recovery window
  });
});
```

## Troubleshooting

### Q: Circuit keeps opening and closing?
**A**: Backend is unstable. Service may need:
- Resource allocation increase
- Bug fix (check logs)
- Dependency health check
- Load reduction

### Q: Circuit won't close from HALF_OPEN?
**A**: Backend not fully recovered. Options:
- Wait longer (don't rush recovery)
- Investigate why successes aren't happening
- Check backend for persistent errors

### Q: Why is recovery taking 30 seconds?
**A**: By design, to avoid hammering recovering services.
To adjust: modify `timeout` parameter (current: 30000ms)

### Q: How do I force reset a circuit?
**A**: Current implementation: no manual reset (by design - prevents masking issues)
Workaround: Redeploy the gateway to reset all circuits

## Alerts to Set Up

Based on your monitoring system:

```
ALERT: circuitBreakers.{service}.state == "OPEN"
  - Severity: HIGH
  - Action: Investigate backend service
  - Runbook: See scenario above

ALERT: circuitBreakers.{service}.state == "HALF_OPEN" for > 2 minutes
  - Severity: MEDIUM
  - Action: Backend recovery is slow, may need investigation
  
ALERT: totalErrors / totalRequests > 5%
  - Severity: MEDIUM
  - Action: High error rate, check all circuits
```

## Performance Impact

- Circuit breaker check: ~0-1ms per request
- Memory overhead: ~100 bytes per service
- No disk I/O
- No external dependencies

**Net Effect**: Improved performance due to fail-fast error responses

## References

- [CIRCUIT_BREAKER.md](CIRCUIT_BREAKER.md) - Detailed documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [main.ts](main.ts#L242) - Implementation details
