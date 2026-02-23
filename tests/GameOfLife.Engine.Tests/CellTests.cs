using GameOfLife.Engine.Models;

namespace GameOfLife.Engine.Tests;

public class CellTests
{
    [Fact]
    public void Cell_Equality_WorksCorrectly()
    {
        var a = new Cell(1, 2);
        var b = new Cell(1, 2);
        Assert.Equal(a, b);
    }

    [Fact]
    public void Cell_Inequality_WorksCorrectly()
    {
        var a = new Cell(1, 2);
        var b = new Cell(2, 1);
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Cell_HashCode_ConsistentForEqualCells()
    {
        var a = new Cell(long.MaxValue, long.MinValue);
        var b = new Cell(long.MaxValue, long.MinValue);
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
    }

    [Fact]
    public void GetNeighbors_Returns8Cells()
    {
        var cell = new Cell(0, 0);
        var neighbors = cell.GetNeighbors().ToList();
        Assert.Equal(8, neighbors.Count);
    }

    [Fact]
    public void GetNeighbors_ReturnsCorrectCells()
    {
        var cell = new Cell(5, 5);
        var neighbors = cell.GetNeighbors().ToHashSet();

        Assert.Contains(new Cell(4, 4), neighbors);
        Assert.Contains(new Cell(4, 5), neighbors);
        Assert.Contains(new Cell(4, 6), neighbors);
        Assert.Contains(new Cell(5, 4), neighbors);
        Assert.Contains(new Cell(5, 6), neighbors);
        Assert.Contains(new Cell(6, 4), neighbors);
        Assert.Contains(new Cell(6, 5), neighbors);
        Assert.Contains(new Cell(6, 6), neighbors);
        Assert.DoesNotContain(new Cell(5, 5), neighbors);
    }

    [Fact]
    public void GetNeighbors_LargeCoordinates_WorksCorrectly()
    {
        var cell = new Cell(-2_000_000_000_000, -2_000_000_000_000);
        var neighbors = cell.GetNeighbors().ToList();
        Assert.Equal(8, neighbors.Count);
        Assert.Contains(new Cell(-2_000_000_000_001, -2_000_000_000_001), neighbors);
    }

    [Fact]
    public void Cell_WorksInHashSet()
    {
        var set = new HashSet<Cell>
        {
            new(0, 0),
            new(0, 0), // duplicate
            new(1, 1)
        };
        Assert.Equal(2, set.Count);
    }

    [Fact]
    public void GetNeighbors_AtMaxCorner_Returns3Neighbors()
    {
        // At (MaxValue, MaxValue) only 3 in-bounds neighbors exist — the hard wall clips the rest.
        var cell = new Cell(long.MaxValue, long.MaxValue);
        var neighbors = cell.GetNeighbors().ToList();
        Assert.Equal(3, neighbors.Count);
        Assert.Contains(new Cell(long.MaxValue - 1, long.MaxValue - 1), neighbors);
        Assert.Contains(new Cell(long.MaxValue - 1, long.MaxValue), neighbors);
        Assert.Contains(new Cell(long.MaxValue, long.MaxValue - 1), neighbors);
    }

    [Fact]
    public void GetNeighbors_AtMinCorner_Returns3Neighbors()
    {
        // At (MinValue, MinValue) only 3 in-bounds neighbors exist.
        var cell = new Cell(long.MinValue, long.MinValue);
        var neighbors = cell.GetNeighbors().ToList();
        Assert.Equal(3, neighbors.Count);
        Assert.Contains(new Cell(long.MinValue + 1, long.MinValue + 1), neighbors);
        Assert.Contains(new Cell(long.MinValue + 1, long.MinValue), neighbors);
        Assert.Contains(new Cell(long.MinValue, long.MinValue + 1), neighbors);
    }

    [Fact]
    public void GetNeighbors_AtEdge_Returns5Neighbors()
    {
        // At (MaxValue, 0) — on the right edge but not a corner — 5 neighbors remain.
        var cell = new Cell(long.MaxValue, 0);
        var neighbors = cell.GetNeighbors().ToList();
        Assert.Equal(5, neighbors.Count);
    }
}
