using GameOfLife.Engine.Models;

namespace GameOfLife.Engine.Services;

public interface IGameEngine
{
    HashSet<Cell> Tick(HashSet<Cell> aliveCells);
    HashSet<Cell> Simulate(HashSet<Cell> aliveCells, int generations);
}
