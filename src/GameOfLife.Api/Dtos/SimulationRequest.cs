using System.ComponentModel.DataAnnotations;

namespace GameOfLife.Api.Dtos;

public class SimulationRequest
{
    [Required]
    [MaxLength(1_000_000)]
    public required string[][] Cells { get; set; }

    [Range(1, 1000)]
    public int Generations { get; set; } = 1;
}