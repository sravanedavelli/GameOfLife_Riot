using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GameOfLife.Api.Dtos;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GameOfLife.Api.Tests;

public class GameControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public GameControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    // Helper: build a string[][] cell array from long pairs.
    private static string[][] Cells(params (long x, long y)[] pairs) =>
        pairs.Select(p => new[] { p.x.ToString(), p.y.ToString() }).ToArray();

    [Fact]
    public async Task Tick_BlinkerOscillates()
    {
        var request = new TickRequest { Cells = Cells((0, -1), (0, 0), (0, 1)) };

        var response = await _client.PostAsJsonAsync("/api/game/tick", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        Assert.Equal(3, result.LiveCellCount);

        var cells = result.Cells.Select(c => (c[0], c[1])).ToHashSet();
        Assert.Contains(("-1", "0"), cells);
        Assert.Contains(("0", "0"), cells);
        Assert.Contains(("1", "0"), cells);
    }

    [Fact]
    public async Task Simulate_TenGenerations_BlinkerReturnsToOriginal()
    {
        var request = new SimulationRequest
        {
            Cells = Cells((0, -1), (0, 0), (0, 1)),
            Generations = 10
        };

        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        Assert.Equal(3, result.LiveCellCount);

        var cells = result.Cells.Select(c => (c[0], c[1])).ToHashSet();
        Assert.Contains(("0", "-1"), cells);
        Assert.Contains(("0", "0"), cells);
        Assert.Contains(("0", "1"), cells);
    }

    [Fact]
    public async Task Simulate_InvalidGenerations_ReturnsBadRequest()
    {
        var request = new SimulationRequest
        {
            Cells = Cells((0, 0)),
            Generations = 0
        };

        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Simulate_LargeCoordinates_WorksCorrectly()
    {
        long off = -2_000_000_000_000L;
        var request = new SimulationRequest
        {
            Cells = Cells((off, off), (off, off + 1), (off + 1, off)),
            Generations = 1
        };

        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        Assert.Equal(4, result.LiveCellCount);
    }

    [Fact]
    public async Task Simulate_LongMaxValueCoordinates_SerializedAsStrings()
    {
        // Coordinates at long.MaxValue survive the JSON round-trip as strings
        // without precision loss (impossible with JSON numbers / JS doubles).
        var request = new SimulationRequest
        {
            Cells = new[] { new[] { long.MaxValue.ToString(), long.MaxValue.ToString() } },
            Generations = 1
        };

        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        // A single live cell has no neighbours — it dies. Result is empty.
        Assert.Equal(0, result.LiveCellCount);
    }

    [Fact]
    public async Task Parse_ValidLife106_ReturnsCells()
    {
        var request = new ParseRequest
        {
            Content = "#Life 1.06\n0 1\n1 2\n2 0\n2 1\n2 2\n"
        };

        var response = await _client.PostAsJsonAsync("/api/game/parse", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        Assert.Equal(5, result.LiveCellCount);
    }

    [Fact]
    public async Task Export_ReturnsPlainTextLife106Format()
    {
        var request = new ExportRequest { Cells = Cells((0, 0), (1, 1)) };

        var response = await _client.PostAsJsonAsync("/api/game/export", request);
        response.EnsureSuccessStatusCode();

        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);

        var content = await response.Content.ReadAsStringAsync();
        Assert.StartsWith("#Life 1.06", content);
        Assert.Contains("0 0", content);
        Assert.Contains("1 1", content);
        // Verify real newlines (not JSON-escaped \n sequences)
        Assert.Contains('\n', content);
    }

    [Fact]
    public async Task Tick_EmptyGrid_ReturnsEmpty()
    {
        var request = new TickRequest { Cells = Array.Empty<string[]>() };

        var response = await _client.PostAsJsonAsync("/api/game/tick", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        Assert.Equal(0, result.LiveCellCount);
    }

    [Fact]
    public async Task FullRoundTrip_ParseSimulateExport()
    {
        var parseRequest = new ParseRequest
        {
            Content = "#Life 1.06\n0 1\n1 2\n2 0\n2 1\n2 2\n"
        };

        var parseResponse = await _client.PostAsJsonAsync("/api/game/parse", parseRequest);
        var parsed = await parseResponse.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(parsed);

        var simRequest = new SimulationRequest { Cells = parsed.Cells, Generations = 10 };

        var simResponse = await _client.PostAsJsonAsync("/api/game/simulate", simRequest);
        var simulated = await simResponse.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(simulated);

        var exportRequest = new ExportRequest { Cells = simulated.Cells };
        var exportResponse = await _client.PostAsJsonAsync("/api/game/export", exportRequest);
        var exported = await exportResponse.Content.ReadAsStringAsync();

        Assert.StartsWith("#Life 1.06", exported.Trim());
        Assert.Contains('\n', exported);
    }

    [Fact]
    public async Task Tick_ExceedingCellLimit_ReturnsBadRequest()
    {
        var cells = Enumerable.Range(0, 1_000_001)
            .Select(i => new[] { i.ToString(), "0" })
            .ToArray();

        var request = new TickRequest { Cells = cells };
        var response = await _client.PostAsJsonAsync("/api/game/tick", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Simulate_ExceedingCellLimit_ReturnsBadRequest()
    {
        var cells = Enumerable.Range(0, 1_000_001)
            .Select(i => new[] { i.ToString(), "0" })
            .ToArray();

        var request = new SimulationRequest { Cells = cells, Generations = 1 };
        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Tick_MalformedCellPair_ReturnsBadRequest()
    {
        // Cell has 3 string elements instead of 2.
        using var content = new StringContent(
            "{\"cells\":[[\"0\",\"1\",\"2\"]]}",
            System.Text.Encoding.UTF8,
            "application/json");

        var response = await _client.PostAsync("/api/game/tick", content);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Tick_NonIntegerCoordinate_ReturnsBadRequest()
    {
        using var content = new StringContent(
            "{\"cells\":[[\"abc\",\"0\"]]}",
            System.Text.Encoding.UTF8,
            "application/json");

        var response = await _client.PostAsync("/api/game/tick", content);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Simulate_GenerationsOutOfRange_ReturnsBadRequest()
    {
        var request = new SimulationRequest
        {
            Cells = Cells((0, 0)),
            Generations = 1001
        };

        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Simulate_MaxGenerations_Succeeds()
    {
        // Generations = 1000 is the allowed maximum — must not return 400
        var request = new SimulationRequest
        {
            Cells = Cells((0, -1), (0, 0), (0, 1)),
            Generations = 1000
        };

        var response = await _client.PostAsJsonAsync("/api/game/simulate", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SimulationResponse>(_jsonOptions);
        Assert.NotNull(result);
        Assert.Equal(3, result.LiveCellCount); // blinker period 2, 1000 even gens → original
    }

    [Fact]
    public async Task Parse_FileWithOutOfRangeCoordinate_ReturnsBadRequest()
    {
        // 9223372036854775898 exceeds long.MaxValue — parser must reject the file, not silently drop the line.
        var request = new ParseRequest
        {
            Content = "#Life 1.06\n0 1\n9223372036854775898 0\n1 2\n"
        };

        var response = await _client.PostAsJsonAsync("/api/game/parse", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("invalid or out-of-range", body);
    }

    [Fact]
    public async Task Export_EmptyCells_ReturnsHeaderOnly()
    {
        var request = new ExportRequest { Cells = Array.Empty<string[]>() };

        var response = await _client.PostAsJsonAsync("/api/game/export", request);
        response.EnsureSuccessStatusCode();

        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Equal("#Life 1.06\n", content);
    }
}
