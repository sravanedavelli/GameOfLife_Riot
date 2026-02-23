namespace GameOfLife.Api.Dtos;

public class SimulationResponse
{
    /// <summary>Each cell is a two-element string array [x, y] so that 64-bit long coordinates survive JSON transport without precision loss.</summary>
    public required string[][] Cells { get; set; }
    /// <summary>Number of generations computed in this request (not the absolute simulation generation).</summary>
    public int GenerationsComputed { get; set; }
    public int LiveCellCount { get; set; }
}