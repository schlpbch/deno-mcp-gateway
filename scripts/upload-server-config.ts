/**
 * Server Configuration Upload Script
 *
 * Uploads MCP server configurations to the gateway's dynamic server registry.
 * Usage:
 *   deno run --allow-net --allow-read scripts/upload-server-config.ts [config-file] [gateway-url]
 *
 * Examples:
 *   deno run --allow-net --allow-read scripts/upload-server-config.ts servers.json
 *   deno run --allow-net --allow-read scripts/upload-server-config.ts servers.json http://localhost:8888
 */

interface ServerConfig {
  id: string;
  name: string;
  endpoint: string;
  requiresSession?: boolean;
}

interface ConfigFile {
  servers: ServerConfig[];
}

const DEFAULT_GATEWAY_URL = 'http://localhost:8888';
const DEFAULT_CONFIG_FILE = './servers-config.json';

async function loadConfigFile(filePath: string): Promise<ConfigFile> {
  try {
    const content = await Deno.readTextFile(filePath);
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse configuration file: ${errorMessage}`);
  }
}

async function uploadServerConfig(
  server: ServerConfig,
  gatewayUrl: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const registerUrl = `${gatewayUrl}/mcp/servers/register`;

  try {
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(server),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        message: `Failed to register server "${server.name}"`,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || `✓ Successfully registered "${server.name}"`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Error registering server "${server.name}"`,
      error: errorMessage,
    };
  }
}

async function verifyGatewayConnection(gatewayUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${gatewayUrl}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const args = Deno.args;
  const configFile = args[0] || DEFAULT_CONFIG_FILE;
  const gatewayUrl = args[1] || DEFAULT_GATEWAY_URL;

  console.log('📋 MCP Server Configuration Upload Script');
  console.log('==========================================\n');
  console.log(`Gateway URL: ${gatewayUrl}`);
  console.log(`Config File: ${configFile}\n`);

  // Verify gateway connection
  console.log('🔍 Verifying gateway connection...');
  const isConnected = await verifyGatewayConnection(gatewayUrl);
  if (!isConnected) {
    console.error(
      `❌ Error: Cannot connect to gateway at ${gatewayUrl}`
    );
    console.error(
      '   Make sure the gateway is running (e.g., deno task dev or deno task start)'
    );
    Deno.exit(1);
  }
  console.log('✓ Gateway is reachable\n');

  // Load configuration
  console.log('📂 Loading configuration file...');
  let config: ConfigFile;
  try {
    config = await loadConfigFile(configFile);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${errorMessage}`);
    Deno.exit(1);
  }

  if (!config.servers || !Array.isArray(config.servers)) {
    console.error('❌ Configuration must contain a "servers" array');
    Deno.exit(1);
  }

  if (config.servers.length === 0) {
    console.warn('⚠️  No servers found in configuration');
    Deno.exit(0);
  }

  console.log(`✓ Loaded ${config.servers.length} server(s)\n`);

  // Upload servers
  console.log('📤 Uploading server configurations...\n');

  let successCount = 0;
  let failureCount = 0;

  for (const server of config.servers) {
    // Validate required fields
    if (!server.id || !server.name || !server.endpoint) {
      console.error(
        `❌ Invalid server config: missing required fields (id, name, endpoint)`
      );
      failureCount++;
      continue;
    }

    // Validate endpoint URL
    try {
      new URL(server.endpoint);
    } catch {
      console.error(
        `❌ Invalid endpoint URL for "${server.name}": ${server.endpoint}`
      );
      failureCount++;
      continue;
    }

    const result = await uploadServerConfig(server, gatewayUrl);
    if (result.success) {
      console.log(result.message);
      successCount++;
    } else {
      console.error(`${result.message}`);
      if (result.error) {
        console.error(`   Error: ${result.error}`);
      }
      failureCount++;
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('📊 Upload Summary');
  console.log('==========================================');
  console.log(`✓ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📊 Total: ${config.servers.length}`);

  if (failureCount > 0) {
    Deno.exit(1);
  }
}

main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Fatal error:', errorMessage);
  Deno.exit(1);
});
