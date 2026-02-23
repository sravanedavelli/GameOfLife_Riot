using System.ComponentModel.DataAnnotations;

namespace GameOfLife.Api.Dtos;

public class TickRequest
{
    [Required]
    [MaxLength(1_000_000)]
    public required string[][] Cells { get; set; }
}