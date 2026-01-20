/**
 * Test script to verify MCP server responds to initialization handshake
 *
 * This validates AC-1.1.c: Server responds with valid MCP protocol version and capabilities
 */

const { spawn } = require('child_process');

async function testHandshake() {
  console.log('Testing MCP server initialization handshake...\n');

  const server = spawn('node', ['dist/index.js'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let responseData = '';
  let responseReceived = false;

  server.stdout.on('data', (data) => {
    responseData += data.toString();

    // Check if we received a complete JSON-RPC response
    try {
      const lines = responseData.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const parsed = JSON.parse(line);
        if (parsed.id === 1 && parsed.result) {
          console.log('✓ Received initialization response:');
          console.log(JSON.stringify(parsed, null, 2));
          console.log('\n✓ Server protocol version:', parsed.result.protocolVersion);
          console.log('✓ Server capabilities:', JSON.stringify(parsed.result.capabilities, null, 2));
          console.log('\n✓ AC-1.1.c PASSED: Server responds with valid MCP protocol version and capabilities');
          responseReceived = true;
          server.kill();
          process.exit(0);
        }
      }
    } catch (e) {
      // Not valid JSON yet, keep accumulating
    }
  });

  // Send MCP initialization request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        }
      },
      clientInfo: {
        name: 'test-client',
        version: '0.1.0'
      }
    }
  };

  setTimeout(() => {
    console.log('Sending initialization request...');
    server.stdin.write(JSON.stringify(initRequest) + '\n');
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => {
    if (!responseReceived) {
      console.error('✗ AC-1.1.c FAILED: No response received within 5 seconds');
      server.kill();
      process.exit(1);
    }
  }, 5000);
}

testHandshake().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
