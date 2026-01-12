/**
 * Tests for MCP Protocol Request Validation
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  validateToolCall,
  validateResourceRead,
  validatePromptGet,
  validateNamespace,
  sanitizeInput,
} from './mcpValidation.ts';

// ============================================================================
// Tool Call Validation Tests
// ============================================================================

Deno.test('validateToolCall - valid tool call with namespace', () => {
  const result = validateToolCall({
    name: 'journey-service-mcp__findTrips',
    arguments: { from: 'Bern', to: 'Zurich' },
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validateToolCall - valid tool call without arguments', () => {
  const result = validateToolCall({
    name: 'aareguru-mcp__getCurrentConditions',
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validateToolCall - missing name field', () => {
  const result = validateToolCall({
    arguments: { from: 'Bern' },
  });
  assertEquals(result.valid, false);
  assertEquals(result.errors.includes('name is required'), true);
});

Deno.test('validateToolCall - invalid namespace format (no separator)', () => {
  const result = validateToolCall({
    name: 'invalidtoolname',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('must match pattern')),
    true
  );
});

Deno.test('validateToolCall - invalid characters in namespace', () => {
  const result = validateToolCall({
    name: 'invalid@namespace__findTrips',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('must match pattern')),
    true
  );
});

Deno.test('validateToolCall - prototype pollution attempt (__proto__)', () => {
  // Simulate JSON.parse which creates actual __proto__ properties
  const params = JSON.parse('{"name":"journey-service-mcp__findTrips","arguments":{"__proto__":{"isAdmin":true}}}')
  const result = validateToolCall(params);
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('forbidden keys')),
    true
  );
});

Deno.test('validateToolCall - prototype pollution attempt (constructor)', () => {
  const result = validateToolCall({
    name: 'journey-service-mcp__findTrips',
    arguments: { constructor: { prototype: { isAdmin: true } } },
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('forbidden keys')),
    true
  );
});

Deno.test('validateToolCall - nested prototype pollution', () => {
  // Simulate JSON.parse which creates actual __proto__ properties
  const params = JSON.parse('{"name":"journey-service-mcp__findTrips","arguments":{"data":{"nested":{"__proto__":{"evil":true}}}}}')
  const result = validateToolCall(params);
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('forbidden keys')),
    true
  );
});

Deno.test('validateToolCall - invalid params type', () => {
  const result = validateToolCall('not an object');
  assertEquals(result.valid, false);
  assertEquals(result.errors.includes('params must be an object'), true);
});

Deno.test('validateToolCall - arguments not an object', () => {
  const result = validateToolCall({
    name: 'journey-service-mcp__findTrips',
    arguments: 'invalid',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.includes('arguments must be an object'),
    true
  );
});

// ============================================================================
// Resource Read Validation Tests
// ============================================================================

Deno.test('validateResourceRead - valid resource URI', () => {
  const result = validateResourceRead({
    uri: 'journey://trips/123',
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validateResourceRead - valid URI with complex path', () => {
  const result = validateResourceRead({
    uri: 'swiss-mobility://bookings/2024/trip-456',
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validateResourceRead - missing URI field', () => {
  const result = validateResourceRead({});
  assertEquals(result.valid, false);
  assertEquals(result.errors.includes('uri is required'), true);
});

Deno.test('validateResourceRead - invalid URI format (no scheme)', () => {
  const result = validateResourceRead({
    uri: 'invalid-uri-without-scheme',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('must include a scheme')),
    true
  );
});

Deno.test('validateResourceRead - dangerous URI scheme (file://)', () => {
  const result = validateResourceRead({
    uri: 'file:///etc/passwd',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('not allowed')),
    true
  );
});

Deno.test('validateResourceRead - dangerous URI scheme (javascript://)', () => {
  const result = validateResourceRead({
    uri: 'javascript://alert(1)',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('not allowed')),
    true
  );
});

Deno.test('validateResourceRead - dangerous URI scheme (data://)', () => {
  const result = validateResourceRead({
    uri: 'data://text/html,<script>alert(1)</script>',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('not allowed')),
    true
  );
});

Deno.test('validateResourceRead - invalid params type', () => {
  const result = validateResourceRead(null);
  assertEquals(result.valid, false);
  assertEquals(result.errors.includes('params must be an object'), true);
});

// ============================================================================
// Prompt Get Validation Tests
// ============================================================================

Deno.test('validatePromptGet - valid prompt request', () => {
  const result = validatePromptGet({
    name: 'journey-service-mcp__tripSummary',
    arguments: { tripId: '123' },
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validatePromptGet - valid prompt without arguments', () => {
  const result = validatePromptGet({
    name: 'aareguru-mcp__currentStatus',
  });
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validatePromptGet - missing name field', () => {
  const result = validatePromptGet({
    arguments: { tripId: '123' },
  });
  assertEquals(result.valid, false);
  assertEquals(result.errors.includes('name is required'), true);
});

Deno.test('validatePromptGet - invalid namespace format', () => {
  const result = validatePromptGet({
    name: 'invalidpromptname',
  });
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('must match pattern')),
    true
  );
});

// ============================================================================
// Namespace Validation Tests
// ============================================================================

Deno.test('validateNamespace - valid namespace', () => {
  const result = validateNamespace('journey-service-mcp__findTrips');
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('validateNamespace - invalid format', () => {
  const result = validateNamespace('invalidname');
  assertEquals(result.valid, false);
  assertEquals(
    result.errors.some((e) => e.includes('must match pattern')),
    true
  );
});

// ============================================================================
// Input Sanitization Tests
// ============================================================================

Deno.test('sanitizeInput - remove __proto__ from object', () => {
  // Simulate JSON.parse which creates actual __proto__ properties
  const input = JSON.parse('{"name":"test","__proto__":{"isAdmin":true},"data":"valid"}');
  const result = sanitizeInput(input) as Record<string, unknown>;
  assertEquals(result.name, 'test');
  assertEquals(result.data, 'valid');
  assertEquals(Object.prototype.hasOwnProperty.call(result, '__proto__'), false);
});

Deno.test('sanitizeInput - remove constructor from object', () => {
  // Simulate JSON.parse which creates actual constructor properties
  const input = JSON.parse('{"name":"test","constructor":{"prototype":{"isAdmin":true}}}');
  const result = sanitizeInput(input) as Record<string, unknown>;
  assertEquals(result.name, 'test');
  assertEquals(Object.prototype.hasOwnProperty.call(result, 'constructor'), false);
});

Deno.test('sanitizeInput - preserve valid nested objects', () => {
  const input = {
    name: 'test',
    data: {
      nested: {
        value: 123,
      },
    },
  };
  const result = sanitizeInput(input) as Record<string, unknown>;
  assertEquals(result.name, 'test');
  assertEquals((result.data as Record<string, unknown>).nested, {
    value: 123,
  });
});

Deno.test('sanitizeInput - handle arrays', () => {
  // Simulate JSON.parse which creates actual __proto__ properties
  const input = JSON.parse('{"items":[{"name":"item1","__proto__":{"evil":true}},{"name":"item2"}]}');
  const result = sanitizeInput(input) as Record<string, unknown>;
  const items = result.items as Array<Record<string, unknown>>;
  assertEquals(items.length, 2);
  assertEquals(items[0].name, 'item1');
  assertEquals(Object.prototype.hasOwnProperty.call(items[0], '__proto__'), false);
  assertEquals(items[1].name, 'item2');
});

Deno.test('sanitizeInput - handle null and undefined', () => {
  assertEquals(sanitizeInput(null), null);
  assertEquals(sanitizeInput(undefined), undefined);
});

Deno.test('sanitizeInput - handle primitives', () => {
  assertEquals(sanitizeInput('string'), 'string');
  assertEquals(sanitizeInput(123), 123);
  assertEquals(sanitizeInput(true), true);
});

Deno.test('sanitizeInput - deeply nested prototype pollution', () => {
  // Simulate JSON.parse which creates actual __proto__ properties
  const input = JSON.parse('{"level1":{"level2":{"level3":{"__proto__":{"evil":true},"data":"valid"}}}}');
  const result = sanitizeInput(input) as Record<string, unknown>;
  const level3 = (
    (result.level1 as Record<string, unknown>).level2 as Record<string, unknown>
  ).level3 as Record<string, unknown>;
  assertEquals(level3.data, 'valid');
  assertEquals(Object.prototype.hasOwnProperty.call(level3, '__proto__'), false);
});
