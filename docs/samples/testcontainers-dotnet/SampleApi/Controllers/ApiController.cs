using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web.Resource;

namespace SampleApi.Controllers;

[ApiController]
[Route("api")]
public class ApiController : ControllerBase
{
    // Public endpoint - no authentication required
    [HttpGet("public")]
    public IActionResult GetPublic()
    {
        return Ok(new { message = "This is a public endpoint" });
    }

    // Protected endpoint - requires authentication
    [HttpGet("protected")]
    [Authorize]
    public IActionResult GetProtected()
    {
        return Ok(new { message = "This endpoint requires authentication" });
    }

    // Scope-protected endpoint - requires 'read' scope
    [HttpGet("data")]
    [Authorize]
    [RequiredScope("read")]
    public IActionResult GetData()
    {
        return Ok(new
        {
            data = new[] { "item1", "item2", "item3" }
        });
    }

    // Scope-protected endpoint - requires 'write' scope
    [HttpPost("data")]
    [Authorize]
    [RequiredScope("write")]
    public IActionResult CreateData([FromBody] DataItem item)
    {
        return Ok(new
        {
            message = $"Created item: {item.Name}",
            id = Guid.NewGuid()
        });
    }

    // User info endpoint - returns claims from the authenticated user
    [HttpGet("userinfo")]
    [Authorize]
    public IActionResult GetUserInfo()
    {
        return Ok(new
        {
            userId = User.FindFirst("sub")?.Value,
            username = User.FindFirst("name")?.Value,
            email = User.FindFirst("email")?.Value,
            claims = User.Claims.Select(c => new { c.Type, c.Value })
        });
    }
}

public record DataItem(string Name);
