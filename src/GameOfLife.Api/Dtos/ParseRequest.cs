using System.ComponentModel.DataAnnotations;

namespace GameOfLife.Api.Dtos;

public class ParseRequest
{
    [Required]
    [MaxLength(10_000_000)]
    public required string Content { get; set; }
}