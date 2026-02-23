namespace GameOfLife.Engine.Models;

/// <summary>
/// Represents a cell coordinate in 64-bit signed integer space.
/// Using record struct for value-type semantics with built-in equality and hashing.
/// </summary>
public readonly record struct Cell(long X, long Y)
{
    private static readonly (int Dx, int Dy)[] Offsets =
    {
        (-1, -1), (-1, 0), (-1, 1),
        ( 0, -1),          ( 0, 1),
        ( 1, -1), ( 1, 0), ( 1, 1)
    };

    public IEnumerable<Cell> GetNeighbors()
    {
        foreach (var (dx, dy) in Offsets)
        {
            // Skip neighbors that would cross the 64-bit boundary — hard wall, no wraparound.
            if (dx == 1 && X == long.MaxValue) continue;
            if (dx == -1 && X == long.MinValue) continue;
            if (dy == 1 && Y == long.MaxValue) continue;
            if (dy == -1 && Y == long.MinValue) continue;
            yield return new Cell(X + dx, Y + dy);
        }
    }
}
