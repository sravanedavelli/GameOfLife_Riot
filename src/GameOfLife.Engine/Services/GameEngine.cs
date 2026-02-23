using GameOfLife.Engine.Models;

namespace GameOfLife.Engine.Services;

public class GameEngine : IGameEngine
{
    /// <summary>
    /// Advances the simulation by one generation.
    /// Uses a neighbor-counting approach: for every alive cell, increment
    /// the count of all its neighbors in a dictionary. Then apply the rules:
    /// - Alive cell with 2 or 3 neighbors survives
    /// - Dead cell with exactly 3 neighbors becomes alive
    /// </summary>
    public HashSet<Cell> Tick(HashSet<Cell> aliveCells)
    {
        if (aliveCells.Count == 0)
            return new HashSet<Cell>();

        var neighborCounts = new Dictionary<Cell, int>();

        foreach (var cell in aliveCells)
        {
            foreach (var neighbor in cell.GetNeighbors())
            {
                if (neighborCounts.TryGetValue(neighbor, out var count))
                    neighborCounts[neighbor] = count + 1;
                else
                    neighborCounts[neighbor] = 1;
            }
        }

        var nextGeneration = new HashSet<Cell>();

        foreach (var (cell, count) in neighborCounts)
        {
            if (count == 3 || (count == 2 && aliveCells.Contains(cell)))
            {
                nextGeneration.Add(cell);
            }
        }

        return nextGeneration;
    }

    public HashSet<Cell> Simulate(HashSet<Cell> aliveCells, int generations)
    {
        var current = aliveCells;
        for (int i = 0; i < generations; i++)
        {
            current = Tick(current);
        }
        return current;
    }
}
