using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure JWT Bearer authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // OAuth server URL will be set dynamically in tests
        var authority = builder.Configuration["Authentication:Authority"] ?? "http://localhost:3000";
        
        options.Authority = authority;
        options.RequireHttpsMetadata = false; // Allow HTTP for testing
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = authority,
            ValidateAudience = false, // ngauth doesn't set audience by default
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });

builder.Services.AddAuthorization(options =>
{
    // Policy requiring specific scope
    options.AddPolicy("RequireReadScope", policy =>
        policy.RequireClaim("scope", "read"));
    
    options.AddPolicy("RequireWriteScope", policy =>
        policy.RequireClaim("scope", "write"));
});

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseAuthentication();
app.UseAuthorization();

// Public endpoint - no authentication required
app.MapGet("/api/public", () => new { message = "This is a public endpoint" })
    .WithName("GetPublic");

// Protected endpoint - requires authentication
app.MapGet("/api/protected", [Authorize] () => new { message = "This endpoint requires authentication" })
    .WithName("GetProtected");

// Scope-protected endpoint - requires 'read' scope
app.MapGet("/api/data", [Authorize(Policy = "RequireReadScope")] () => new
{
    data = new[] { "item1", "item2", "item3" }
})
    .WithName("GetData");

// Scope-protected endpoint - requires 'write' scope
app.MapPost("/api/data", [Authorize(Policy = "RequireWriteScope")] (DataItem item) => new
{
    message = $"Created item: {item.Name}",
    id = Guid.NewGuid()
})
    .WithName("CreateData");

// User info endpoint - returns claims from the authenticated user
app.MapGet("/api/userinfo", [Authorize] (HttpContext context) => new
{
    userId = context.User.FindFirst("sub")?.Value,
    username = context.User.FindFirst("name")?.Value,
    email = context.User.FindFirst("email")?.Value,
    claims = context.User.Claims.Select(c => new { c.Type, c.Value })
})
    .WithName("GetUserInfo");

app.Run();

public record DataItem(string Name);

// Make the implicit Program class accessible to tests
public partial class Program { }
