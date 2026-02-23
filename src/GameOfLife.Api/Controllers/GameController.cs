using Asp.Versioning;
using GameOfLife.Api.Dtos;
using GameOfLife.Engine.Models;
using GameOfLife.Engine.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GameOfLife.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting("game")]
public class GameController : ControllerBase
{
    private const int MaxCells = 1_000_000;

    private readonly IGameEngine _engine;
    private readonly ILogger<GameController> _logger;

    public GameController(IGameEngine engine, ILogger<GameController> logger)
    {
        _engine = engine;
        _logger = logger;
    }

    [HttpPost("tick")]
    [RequestSizeLimit(50_000_000)]
    public ActionResult<SimulationResponse> Tick([FromBody] TickRequest request)
    {
        _logger.LogInformation("Tick requested with {InputCellCount} cells", request.Cells.Length);

        if (request.Cells.Length > MaxCells)
        {
            _logger.LogWarning("Tick rejected: {InputCellCount} exceeds MaxCells {MaxCells}", request.Cells.Length, MaxCells);
            return BadRequest($"Cell count {request.Cells.Length} exceeds maximum of {MaxCells}.");
        }

        if (!TryConvertToCells(request.Cells, out var cells, out var error))
        {
            _logger.LogWarning("Tick rejected: invalid cell data — {Error}", error);
            return BadRequest(error);
        }

        var result = _engine.Tick(cells);
        _logger.LogInformation("Tick completed: {InputCellCount} → {OutputCellCount} cells", request.Cells.Length, result.Count);
        return Ok(CreateResponse(result, 1));
    }

    [HttpPost("simulate")]
    [RequestSizeLimit(50_000_000)]
    public ActionResult<SimulationResponse> Simulate([FromBody] SimulationRequest request)
    {
        _logger.LogInformation("Simulate requested: {InputCellCount} cells × {Generations} generations", request.Cells.Length, request.Generations);

        if (request.Generations < 1 || request.Generations > 1000)
        {
            _logger.LogWarning("Simulate rejected: {Generations} is out of allowed range [1,1000]", request.Generations);
            return BadRequest("Generations must be between 1 and 1000.");
        }

        if (request.Cells.Length > MaxCells)
        {
            _logger.LogWarning("Simulate rejected: {InputCellCount} exceeds MaxCells {MaxCells}", request.Cells.Length, MaxCells);
            return BadRequest($"Cell count {request.Cells.Length} exceeds maximum of {MaxCells}.");
        }

        if (!TryConvertToCells(request.Cells, out var cells, out var error))
        {
            _logger.LogWarning("Simulate rejected: invalid cell data — {Error}", error);
            return BadRequest(error);
        }

        var result = _engine.Simulate(cells, request.Generations);
        _logger.LogInformation("Simulate completed: {InputCellCount} → {OutputCellCount} cells after {Generations} generations", request.Cells.Length, result.Count, request.Generations);
        return Ok(CreateResponse(result, request.Generations));
    }

    [HttpPost("parse")]
    [RequestSizeLimit(12_000_000)]
    public ActionResult<SimulationResponse> Parse([FromBody] ParseRequest request)
    {
        _logger.LogInformation("Parse requested: {ContentLength} chars", request.Content?.Length ?? 0);

        var (cells, invalidLines) = Life106Parser.Parse(request.Content ?? string.Empty);

        if (invalidLines > 0)
        {
            _logger.LogWarning("Parse rejected: {InvalidLines} line(s) with invalid or out-of-range coordinates", invalidLines);
            return BadRequest($"File contains {invalidLines} line(s) with invalid or out-of-range coordinates.");
        }

        if (cells.Count > MaxCells)
        {
            _logger.LogWarning("Parse rejected: {ParsedCellCount} exceeds MaxCells {MaxCells}", cells.Count, MaxCells);
            return BadRequest($"Parsed cell count {cells.Count} exceeds maximum of {MaxCells}.");
        }

        _logger.LogInformation("Parse completed: {ParsedCellCount} cells loaded", cells.Count);
        return Ok(CreateResponse(cells, 0));
    }

    [HttpPost("export")]
    [RequestSizeLimit(50_000_000)]
    public IActionResult Export([FromBody] ExportRequest request)
    {
        _logger.LogInformation("Export requested: {CellCount} cells", request.Cells.Length);

        if (request.Cells.Length > MaxCells)
        {
            _logger.LogWarning("Export rejected: {CellCount} exceeds MaxCells {MaxCells}", request.Cells.Length, MaxCells);
            return BadRequest($"Cell count {request.Cells.Length} exceeds maximum of {MaxCells}.");
        }

        if (!TryConvertToCells(request.Cells, out var cells, out var error))
        {
            _logger.LogWarning("Export rejected: invalid cell data — {Error}", error);
            return BadRequest(error);
        }

        var output = Life106Parser.Serialize(cells);
        _logger.LogInformation("Export completed: {CellCount} cells serialized", cells.Count);
        return Content(output, "text/plain");
    }

    private static bool TryConvertToCells(string[][] raw, out HashSet<Cell> cells, out string? error)
    {
        cells = new HashSet<Cell>();
        for (int i = 0; i < raw.Length; i++)
        {
            var pair = raw[i];
            if (pair.Length != 2)
            {
                error = $"Cell at index {i} must have exactly 2 coordinates, got {pair.Length}.";
                return false;
            }
            if (!long.TryParse(pair[0], out var x) || !long.TryParse(pair[1], out var y))
            {
                error = $"Cell at index {i} has a non-integer coordinate.";
                return false;
            }
            cells.Add(new Cell(x, y));
        }
        error = null;
        return true;
    }

    private static SimulationResponse CreateResponse(HashSet<Cell> cells, int generationsComputed)
    {
        return new SimulationResponse
        {
            // Coordinates are serialized as strings so 64-bit longs survive JSON transport
            // without silent precision loss in JavaScript's IEEE-754 double.
            Cells = cells.OrderBy(c => c.X).ThenBy(c => c.Y)
                         .Select(c => new[] { c.X.ToString(), c.Y.ToString() }).ToArray(),
            GenerationsComputed = generationsComputed,
            LiveCellCount = cells.Count
        };
    }
}