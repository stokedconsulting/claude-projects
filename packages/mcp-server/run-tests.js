// Simple test runner to verify the tool registry works
const { ToolRegistry } = require('./dist/tools/registry.js');

async function runTests() {
  console.log('Running Tool Registry Tests...\n');

  const registry = new ToolRegistry();
  let passedTests = 0;
  let failedTests = 0;

  // Test 1: AC-1.3.a - Tool registration and listing
  console.log('Test 1: Tool registration and listing');
  try {
    registry.registerTool({
      name: 'echo',
      description: 'Echoes back the provided message',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      },
      handler: async (params) => ({
        content: [{ type: 'text', text: params.message }]
      })
    });

    const tools = registry.listTools();
    if (tools.length === 1 && tools[0].name === 'echo') {
      console.log('✓ PASSED: Tool registered and appears in list\n');
      passedTests++;
    } else {
      console.log('✗ FAILED: Tool not properly registered\n');
      failedTests++;
    }
  } catch (error) {
    console.log('✗ FAILED:', error.message, '\n');
    failedTests++;
  }

  // Test 2: AC-1.3.b - Parameter validation
  console.log('Test 2: Parameter validation errors');
  try {
    const result = await registry.executeTool('echo', {});  // Missing required 'message'

    if (result.isError && result.content[0].type === 'text') {
      const error = JSON.parse(result.content[0].text);
      if (error.error === 'Parameter validation failed' && error.validationErrors) {
        console.log('✓ PASSED: Validation error with field-specific messages\n');
        passedTests++;
      } else {
        console.log('✗ FAILED: Incorrect error format\n');
        failedTests++;
      }
    } else {
      console.log('✗ FAILED: Should have returned validation error\n');
      failedTests++;
    }
  } catch (error) {
    console.log('✗ FAILED:', error.message, '\n');
    failedTests++;
  }

  // Test 3: AC-1.3.c - Exception handling
  console.log('Test 3: Exception handling');
  try {
    registry.clear();
    registry.registerTool({
      name: 'error-tool',
      description: 'Throws an error',
      inputSchema: {
        type: 'object',
        properties: {
          trigger: { type: 'string' }
        },
        required: ['trigger']
      },
      handler: async (params) => {
        throw new Error('Simulated error');
      }
    });

    const result = await registry.executeTool('error-tool', { trigger: 'error' });

    if (result.isError && result.content[0].type === 'text') {
      const error = JSON.parse(result.content[0].text);
      if (error.error.includes('Tool execution failed') && error.error.includes('Simulated error')) {
        console.log('✓ PASSED: Exception caught and returned as MCP error\n');
        passedTests++;
      } else {
        console.log('✗ FAILED: Incorrect error format\n');
        failedTests++;
      }
    } else {
      console.log('✗ FAILED: Should have returned error response\n');
      failedTests++;
    }
  } catch (error) {
    console.log('✗ FAILED:', error.message, '\n');
    failedTests++;
  }

  // Test 4: AC-1.3.d - Successful execution
  console.log('Test 4: Successful tool execution');
  try {
    registry.clear();
    registry.registerTool({
      name: 'add',
      description: 'Adds two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      },
      handler: async (params) => ({
        content: [{ type: 'text', text: String(params.a + params.b) }]
      })
    });

    const result = await registry.executeTool('add', { a: 10, b: 5 });

    if (!result.isError && result.content[0].type === 'text' && result.content[0].text === '15') {
      console.log('✓ PASSED: Tool executed successfully with correct output\n');
      passedTests++;
    } else {
      console.log('✗ FAILED: Incorrect execution result\n');
      failedTests++;
    }
  } catch (error) {
    console.log('✗ FAILED:', error.message, '\n');
    failedTests++;
  }

  // Test 5: AC-1.3.e - Multiple tools with correct schemas
  console.log('Test 5: Multiple tools with correct schemas');
  try {
    registry.clear();
    registry.registerTool({
      name: 'tool1',
      description: 'First tool',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' }
        },
        required: ['text']
      },
      handler: async () => ({ content: [{ type: 'text', text: 'ok' }] })
    });

    registry.registerTool({
      name: 'tool2',
      description: 'Second tool',
      inputSchema: {
        type: 'object',
        properties: {
          count: { type: 'number' }
        },
        required: ['count']
      },
      handler: async () => ({ content: [{ type: 'text', text: 'ok' }] })
    });

    const tools = registry.listTools();

    if (tools.length === 2 &&
        tools.find(t => t.name === 'tool1' && t.description === 'First tool') &&
        tools.find(t => t.name === 'tool2' && t.description === 'Second tool')) {
      console.log('✓ PASSED: Multiple tools listed with correct schemas\n');
      passedTests++;
    } else {
      console.log('✗ FAILED: Tools not properly listed\n');
      failedTests++;
    }
  } catch (error) {
    console.log('✗ FAILED:', error.message, '\n');
    failedTests++;
  }

  // Summary
  console.log('='.repeat(50));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log('='.repeat(50));

  if (failedTests === 0) {
    console.log('\n✓ ALL ACCEPTANCE CRITERIA VALIDATED');
    process.exit(0);
  } else {
    console.log('\n✗ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
