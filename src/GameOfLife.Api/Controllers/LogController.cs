using Asp.Versioning;
using GameOfLife.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Serilog.Context;

namespace GameOfLife.Api.Controllers;

/// <summary>
/// Receives structured log events from the React frontend and writes them
/// into the same Serilog pipeline as backend logs.
/// Because the frontend sends X-Correlation-Id on every request, and the
/// CorrelationIdMiddleware pushes it into the LogContext, both frontend and
/// backend log lines for a single transaction share the same CorrelationId.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[EnableRateLimiting("log")]
public class LogController(ILogger<LogController> logger) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(100_000)]
    public IActionResult Log([FromBody] FrontendLogRequest request)
    {
        var level = request.Level?.ToLowerInvariant() switch
        {
            "error"           => LogLevel.Error,
            "warn" or "warning" => LogLevel.Warning,
            "debug"           => LogLevel.Debug,
            _                 => LogLevel.Information,
        };

        // Push frontend-supplied IDs into the log scope so they appear as
        // structured properties alongside the backend CorrelationId already
        // set by CorrelationIdMiddleware.
        using (LogContext.PushProperty("Source", "Frontend"))
        using (LogContext.PushProperty("FrontendSessionId", request.SessionId ?? "unknown"))
        using (LogContext.PushProperty("FrontendCorrelationId", request.CorrelationId ?? "unknown"))
        {
            logger.Log(level, "[Frontend] {Message} {Properties}", request.Message, request.Properties);
        }

        return Ok();
    }
}
