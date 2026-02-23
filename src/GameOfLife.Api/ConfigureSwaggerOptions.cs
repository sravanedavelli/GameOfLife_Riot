using Asp.Versioning.ApiExplorer;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace GameOfLife.Api;

/// <summary>
/// Configures a Swagger document for every API version discovered by
/// IApiVersionDescriptionProvider.  This is the proper DI-based approach:
/// the provider is constructor-injected, so no BuildServiceProvider call
/// is needed and new versions are picked up automatically.
/// </summary>
public class ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider)
    : IConfigureOptions<SwaggerGenOptions>
{
    public void Configure(SwaggerGenOptions options)
    {
        foreach (var description in provider.ApiVersionDescriptions)
        {
            options.SwaggerDoc(description.GroupName, new OpenApiInfo
            {
                Title   = "Game of Life API",
                Version = description.ApiVersion.ToString(),
            });
        }
    }
}
