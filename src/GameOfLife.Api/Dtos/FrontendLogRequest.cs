namespace GameOfLife.Api.Dtos;

/// <summary>
/// Log event sent from the React frontend to /api/log.
/// Stored in the backend log stream so frontend and backend events
/// are searchable together by CorrelationId / SessionId.
/// </summary>
public record FrontendLogRequest(
    string Level,
    string Message,
    string? SessionId,
    string? CorrelationId,
    Dictionary<string, object?>? Properties
);
