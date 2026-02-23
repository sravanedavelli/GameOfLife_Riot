using System.Threading.RateLimiting;
using Asp.Versioning;
using Asp.Versioning.ApiExplorer;
using GameOfLife.Api;
using GameOfLife.Api.Middleware;
using GameOfLife.Engine.Services;
using Microsoft.Extensions.Options;
using Serilog;
using Serilog.Debugging;
using Serilog.Events;
using Swashbuckle.AspNetCore.SwaggerGen;

// Print any internal Serilog errors (e.g. file sink failures) to the console.
SelfLog.Enable(Console.Error);

// Bootstrap logger captures any fatal startup errors before the host is built.
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Serilog ────────────────────────────────────────────────────────────
    // Two-stage initialisation: bootstrap logger above → full logger here.
    // Output template includes CorrelationId and SessionId pushed by
    // CorrelationIdMiddleware so every line for a request is traceable.
    // To switch to Kafka/Loki later, add a sink here without changing anything else.
    builder.Host.UseSerilog((ctx, services, cfg) =>
    {
        cfg
            .ReadFrom.Configuration(ctx.Configuration)   // honours appsettings overrides
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()                      // picks up CorrelationId / SessionId
            .Enrich.WithMachineName()
            .Enrich.WithThreadId()
            .Enrich.WithEnvironmentName()
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
            .WriteTo.Console(
                outputTemplate:
                    "[{Timestamp:HH:mm:ss} {Level:u3}] " +
                    "{Message:lj} " +
                    "| cid={CorrelationId} sid={SessionId} " +
                    "| env={EnvironmentName} tid={ThreadId}" +
                    "{NewLine}{Exception}")
            // Rolling file — new file each day, kept for 30 days, max 100 MB per file.
            // Path is relative to the working directory (project root when running locally).
            // Switch formatter to CompactJsonFormatter here when connecting Kafka/Loki.
            .WriteTo.File(
                path: "logs/gameoflife-.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 30,
                fileSizeLimitBytes: 100_000_000,
                outputTemplate:
                    "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] " +
                    "{Message:lj} " +
                    "| cid={CorrelationId} sid={SessionId} " +
                    "| machine={MachineName} tid={ThreadId}" +
                    "{NewLine}{Exception}");
    });

    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();

    // ── API Versioning ──────────────────────────────────────────────────────
    // URL-path versioning: /api/v1/game/tick, /api/v2/game/tick, etc.
    // AssumeDefaultVersionWhenUnspecified lets unversioned calls still work.
    // ReportApiVersions adds api-supported-versions / api-deprecated-versions headers.
    builder.Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
    }).AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";          // e.g. "v1"
        options.SubstituteApiVersionInUrl = true;    // replaces {version} in route templates
    });

    // ── Swagger ─────────────────────────────────────────────────────────────
    // ConfigureSwaggerOptions is injected with IApiVersionDescriptionProvider
    // and builds one SwaggerDoc per discovered version automatically.
    // To add v2: just decorate a controller with [ApiVersion("2.0")] — done.
    builder.Services.AddTransient<IConfigureOptions<SwaggerGenOptions>, ConfigureSwaggerOptions>();
    builder.Services.AddSwaggerGen();

    builder.Services.AddScoped<IGameEngine, GameEngine>();

    // ── Rate Limiting ────────────────────────────────────────────────────────
    // Fixed-window per client IP. Two policies:
    //   "game" — 300 req/min covers max-speed auto-play at 200 ms intervals (5 req/s).
    //   "log"  — 60 req/min; frontend logs should never be that frequent.
    // Returns 429 Too Many Requests when the limit is hit.
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.AddPolicy("game", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 300,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

        options.AddPolicy("log", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 60,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));
    });

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("Frontend", policy =>
        {
            var origins = builder.Configuration
                .GetSection("Cors:AllowedOrigins")
                .Get<string[]>() ?? [];

            policy.WithOrigins(origins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
    });

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            var provider = app.Services.GetRequiredService<IApiVersionDescriptionProvider>();
            foreach (var description in provider.ApiVersionDescriptions)
            {
                options.SwaggerEndpoint(
                    $"/swagger/{description.GroupName}/swagger.json",
                    $"Game of Life API {description.GroupName.ToUpperInvariant()}");
            }
        });
    }

    app.UseCors("Frontend");

    // Global exception handler — catches any unhandled exception, logs it as
    // LogError (so it surfaces in Grafana/Loki as a real error), then returns 500.
    app.UseExceptionHandler(errorApp =>
    {
        errorApp.Run(async context =>
        {
            var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
            if (feature?.Error is { } ex)
            {
                var exLogger = context.RequestServices.GetRequiredService<ILogger<Program>>();
                exLogger.LogError(ex, "Unhandled exception on {Path}", feature.Path);
            }
            context.Response.StatusCode  = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"An unexpected error occurred.\"}");
        });
    });

    // CorrelationId middleware must run before request logging and controllers
    // so that CorrelationId is already in the LogContext when Serilog writes.
    app.UseMiddleware<CorrelationIdMiddleware>();

    // Logs one line per HTTP request: method, path, status, elapsed ms.
    app.UseSerilogRequestLogging(opts =>
    {
        opts.MessageTemplate =
            "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0}ms";
        opts.EnrichDiagnosticContext = (diag, http) =>
        {
            diag.Set("RequestHost",   http.Request.Host.Value);
            diag.Set("RequestScheme", http.Request.Scheme);
            diag.Set("UserAgent",     http.Request.Headers.UserAgent.ToString());
        };
    });

    app.UseRateLimiter();
    app.UseAuthorization();
    app.MapControllers();
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application startup failed");
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program { }
