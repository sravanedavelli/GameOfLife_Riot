using Serilog.Context;

namespace GameOfLife.Api.Middleware;

/// <summary>
/// Reads X-Correlation-Id and X-Session-Id from the incoming request,
/// echoes Correlation-Id back in the response, and pushes both into the
/// Serilog LogContext so every log line for this request carries them.
/// This allows a single transaction to be traced end-to-end across the
/// frontend and backend by searching for the same CorrelationId.
/// </summary>
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string CorrelationHeader = "X-Correlation-Id";
    private const string SessionHeader     = "X-Session-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        // Use the header sent by the frontend, or fall back to ASP.NET's TraceIdentifier.
        var correlationId = context.Request.Headers[CorrelationHeader].FirstOrDefault()
                            ?? context.TraceIdentifier;
        var sessionId = context.Request.Headers[SessionHeader].FirstOrDefault() ?? "unknown";

        // Echo the correlation ID back so the frontend can confirm it was received.
        context.Response.Headers[CorrelationHeader] = correlationId;

        // Push into Serilog LogContext — all log calls within this request will include these.
        using (LogContext.PushProperty("CorrelationId", correlationId))
        using (LogContext.PushProperty("SessionId", sessionId))
        {
            await next(context);
        }
    }
}
