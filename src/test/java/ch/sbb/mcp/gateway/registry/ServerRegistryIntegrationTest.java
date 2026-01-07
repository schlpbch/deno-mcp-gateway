package ch.sbb.mcp.gateway.registry;

import ch.sbb.mcp.gateway.model.ServerCapabilities;
import ch.sbb.mcp.gateway.model.ServerHealth;
import ch.sbb.mcp.gateway.model.ServerRegistration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration test for ServerRegistry functionality.
 */
class ServerRegistryIntegrationTest {

    private ServerRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new ServerRegistry();
    }

    @Test
    void shouldRegisterAndListServers() {
        // Given
        ServerRegistration server1 = createTestServer("server-1", "Server 1");
        ServerRegistration server2 = createTestServer("server-2", "Server 2");

        // When
        registry.register(server1);
        registry.register(server2);

        // Then
        List<ServerRegistration> servers = registry.listServers();
        assertThat(servers).hasSize(2);
        assertThat(servers).extracting(ServerRegistration::id)
            .containsExactlyInAnyOrder("server-1", "server-2");
    }

    @Test
    void shouldUnregisterServer() {
        // Given
        ServerRegistration server = createTestServer("server-1", "Server 1");
        registry.register(server);

        // When
        registry.unregister("server-1");

        // Then
        assertThat(registry.listServers()).isEmpty();
    }

    @Test
    void shouldGetServerById() {
        // Given
        ServerRegistration server = createTestServer("server-1", "Server 1");
        registry.register(server);

        // When
        ServerRegistration found = registry.getServer("server-1");

        // Then
        assertThat(found).isNotNull();
        assertThat(found.id()).isEqualTo("server-1");
        assertThat(found.name()).isEqualTo("Server 1");
    }

    @Test
    void shouldReturnNullForNonExistentServer() {
        // When
        ServerRegistration found = registry.getServer("non-existent");

        // Then
        assertThat(found).isNull();
    }

    @Test
    void shouldFilterHealthyServers() {
        // Given
        ServerRegistration healthy = createTestServer("healthy", "Healthy Server");
        // Manually set to HEALTHY since default is UNKNOWN
        registry.register(healthy);
        registry.updateHealth("healthy", ServerHealth.builder().status(ServerHealth.HealthStatus.HEALTHY).build());
        
        ServerRegistration unhealthy = createTestServer("unhealthy", "Unhealthy Server");
        registry.register(unhealthy);

        // Mark one as unhealthy
        registry.updateHealth(
            "unhealthy",
            ServerHealth.builder()
                .status(ServerHealth.HealthStatus.DOWN)
                .build()
        );

        // When
        List<ServerRegistration> healthyServers = registry.getHealthyServers();

        // Then
        assertThat(healthyServers).hasSize(1);
        assertThat(healthyServers.get(0).id()).isEqualTo("healthy");
    }

    @Test
    void shouldUpdateServerHealth() {
        // Given
        ServerRegistration server = createTestServer("server-1", "Server 1");
        registry.register(server);

        ServerHealth newHealth = ServerHealth.builder()
            .status(ServerHealth.HealthStatus.DEGRADED)
            .build();

        // When
        registry.updateHealth("server-1", newHealth);

        // Then
        ServerRegistration updated = registry.getServer("server-1");
        assertThat(updated.health().status()).isEqualTo(ServerHealth.HealthStatus.DEGRADED);
    }

    @Test
    void shouldResolveToolServer() {
        // Given
        ServerRegistration server = ServerRegistration.builder()
            .id("journey-service-mcp") // Matches "journey" prefix mapping
            .name("Journey Service")
            .endpoint("http://localhost:8080/mcp")
            .transport(ServerRegistration.TransportType.HTTP)
            .capabilities(new ServerCapabilities(
                List.of("findTrips", "compareRoutes"),
                List.of(),
                List.of()
            ))
            .build();
        
        registry.register(server);

        // When
        ServerRegistration found = registry.resolveToolServer("journey.findTrips");

        // Then
        assertThat(found).isNotNull();
        assertThat(found.id()).isEqualTo("journey-service-mcp");
    }

    @Test
    void shouldThrowExceptionWhenToolServerNotFound() {
        // When/Then
        assertThatThrownBy(() -> registry.resolveToolServer("non-existent.tool"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("No server found for tool");
    }

    @Test
    void shouldResolveResourceServer() {
        // Given
        ServerRegistration server = ServerRegistration.builder()
            .id("resource-server")
            .name("Resource Server")
            .endpoint("http://localhost:8080/mcp")
            .transport(ServerRegistration.TransportType.HTTP)
            .capabilities(new ServerCapabilities(
                List.of(),
                List.of(new ServerCapabilities.ResourceCapability(
                    "resource://data/",
                    "Data Resources"
                )),
                List.of()
            ))
            .build();
        
        registry.register(server);

        // When
        ServerRegistration found = registry.resolveResourceServer("resource://data/file.json");

        // Then
        assertThat(found).isNotNull();
        assertThat(found.id()).isEqualTo("resource-server");
    }

    @Test
    void shouldResolvePromptServer() {
        // Given
        ServerRegistration server = ServerRegistration.builder()
            .id("prompt-server-mcp") // Matches "prompt-server" prefix + "-mcp" suffix
            .name("Prompt Server")
            .endpoint("http://localhost:8080/mcp")
            .transport(ServerRegistration.TransportType.HTTP)
            .capabilities(new ServerCapabilities(
                List.of(),
                List.of(),
                List.of("plan-trip", "compare-routes")
            ))
            .build();
        
        registry.register(server);

        // When
        ServerRegistration found = registry.resolvePromptServer("prompt-server.plan-trip");

        // Then
        assertThat(found).isNotNull();
        assertThat(found.id()).isEqualTo("prompt-server-mcp");
    }

    // Helper methods

    private ServerRegistration createTestServer(String id, String name) {
        return ServerRegistration.builder()
            .id(id)
            .name(name)
            .endpoint("http://localhost:8080/mcp")
            .transport(ServerRegistration.TransportType.HTTP)
            .build();
    }
}
