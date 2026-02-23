using GameOfLife.Engine.Models;
using GameOfLife.Engine.Services;

namespace GameOfLife.Engine.Tests;

public class GameEngineTests
{
    private readonly GameEngine _engine = new();

    [Fact]
    public void Tick_EmptyGrid_ReturnsEmpty()
    {
        var result = _engine.Tick(new HashSet<Cell>());
        Assert.Empty(result);
    }

    [Fact]
    public void Tick_SingleCell_Dies()
    {
        var cells = new HashSet<Cell> { new(0, 0) };
        var result = _engine.Tick(cells);
        Assert.Empty(result);
    }

    [Fact]
    public void Tick_Block_StaysStable()
    {
        // Block (still life): 2x2 square
        var block = new HashSet<Cell>
        {
            new(0, 0), new(0, 1),
            new(1, 0), new(1, 1)
        };

        var result = _engine.Tick(block);
        Assert.Equal(block, result);
    }

    [Fact]
    public void Tick_Blinker_Oscillates()
    {
        // Blinker period 2: horizontal line of 3
        var horizontal = new HashSet<Cell>
        {
            new(0, -1), new(0, 0), new(0, 1)
        };

        var vertical = new HashSet<Cell>
        {
            new(-1, 0), new(0, 0), new(1, 0)
        };

        var gen1 = _engine.Tick(horizontal);
        Assert.Equal(vertical, gen1);

        var gen2 = _engine.Tick(gen1);
        Assert.Equal(horizontal, gen2);
    }

    [Fact]
    public void Tick_Glider_MovesCorrectly()
    {
        // Standard glider
        var gen0 = new HashSet<Cell>
        {
            new(0, 1),
            new(1, 2),
            new(2, 0), new(2, 1), new(2, 2)
        };

        // After 4 generations, glider moves (1,1) diagonally
        var result = _engine.Simulate(gen0, 4);
        var expected = new HashSet<Cell>
        {
            new(1, 2),
            new(2, 3),
            new(3, 1), new(3, 2), new(3, 3)
        };

        Assert.Equal(expected, result);
    }

    [Fact]
    public void Tick_ThreeCellsInL_ProducesBlock()
    {
        // Three cells forming an L produce a 2x2 block
        var cells = new HashSet<Cell>
        {
            new(0, 0), new(0, 1), new(1, 0)
        };

        var result = _engine.Tick(cells);

        var expected = new HashSet<Cell>
        {
            new(0, 0), new(0, 1),
            new(1, 0), new(1, 1)
        };
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Tick_LargeCoordinates_WorksCorrectly()
    {
        // Test with coordinates near 64-bit range
        long offset = -2_000_000_000_000L;

        var cells = new HashSet<Cell>
        {
            new(offset, offset),
            new(offset, offset + 1),
            new(offset + 1, offset)
        };

        var result = _engine.Tick(cells);

        var expected = new HashSet<Cell>
        {
            new(offset, offset), new(offset, offset + 1),
            new(offset + 1, offset), new(offset + 1, offset + 1)
        };

        Assert.Equal(expected, result);
    }

    [Fact]
    public void Tick_DisjointClusters_EvolveIndependently()
    {
        // Two blocks far apart should both remain stable
        var cells = new HashSet<Cell>
        {
            // Block at origin
            new(0, 0), new(0, 1), new(1, 0), new(1, 1),
            // Block far away
            new(1_000_000, 1_000_000), new(1_000_000, 1_000_001),
            new(1_000_001, 1_000_000), new(1_000_001, 1_000_001)
        };

        var result = _engine.Tick(cells);
        Assert.Equal(cells, result);
    }

    [Fact]
    public void Simulate_ZeroGenerations_ReturnsSameState()
    {
        var cells = new HashSet<Cell> { new(0, 0), new(0, 1) };
        var result = _engine.Simulate(cells, 0);
        Assert.Equal(cells, result);
    }

    [Fact]
    public void Simulate_BlinkerTenGenerations_ReturnsOriginal()
    {
        // Blinker has period 2, so 10 generations = same state
        var blinker = new HashSet<Cell>
        {
            new(0, -1), new(0, 0), new(0, 1)
        };

        var result = _engine.Simulate(blinker, 10);
        Assert.Equal(blinker, result);
    }

    [Fact]
    public void Tick_Overcrowding_CellDies()
    {
        // Center cell with 4+ neighbors dies
        var cells = new HashSet<Cell>
        {
            new(0, 0),
            new(-1, 0), new(1, 0), new(0, -1), new(0, 1)
        };

        var result = _engine.Tick(cells);
        Assert.DoesNotContain(new Cell(0, 0), result);
    }

    [Fact]
    public void Tick_ExactlyThreeNeighbors_BirthsNewCell()
    {
        // Dead cell at (1,1) has exactly 3 alive neighbors
        var cells = new HashSet<Cell>
        {
            new(0, 0), new(0, 1), new(1, 0)
        };

        var result = _engine.Tick(cells);
        Assert.Contains(new Cell(1, 1), result);
    }
}
