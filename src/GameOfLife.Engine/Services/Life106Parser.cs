using System.Text;
using GameOfLife.Engine.Models;

namespace GameOfLife.Engine.Services;

public static class Life106Parser
{
    private const string Header = "#Life 1.06";

    public static (HashSet<Cell> Cells, int InvalidLines) Parse(string input)
    {
        var cells = new HashSet<Cell>();
        int invalidLines = 0;

        foreach (var rawLine in input.Split('\n'))
        {
            var line = rawLine.Trim();

            if (string.IsNullOrEmpty(line) || line.StartsWith('#'))
                continue;

            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
                continue;

            if (long.TryParse(parts[0], out var x) && long.TryParse(parts[1], out var y))
                cells.Add(new Cell(x, y));
            else
                invalidLines++;
        }

        return (cells, invalidLines);
    }

    public static (HashSet<Cell> Cells, int InvalidLines) Parse(TextReader reader)
    {
        var cells = new HashSet<Cell>();
        int invalidLines = 0;
        string? line;

        while ((line = reader.ReadLine()) != null)
        {
            line = line.Trim();

            if (string.IsNullOrEmpty(line) || line.StartsWith('#'))
                continue;

            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
                continue;

            if (long.TryParse(parts[0], out var x) && long.TryParse(parts[1], out var y))
                cells.Add(new Cell(x, y));
            else
                invalidLines++;
        }

        return (cells, invalidLines);
    }

    public static string Serialize(HashSet<Cell> cells)
    {
        var sb = new StringBuilder();
        sb.Append(Header).Append('\n');

        var sorted = cells.OrderBy(c => c.X).ThenBy(c => c.Y);

        foreach (var cell in sorted)
        {
            sb.Append(cell.X).Append(' ').Append(cell.Y).Append('\n');
        }

        return sb.ToString();
    }

    public static void Serialize(HashSet<Cell> cells, TextWriter writer)
    {
        writer.Write(Header + "\n");

        var sorted = cells.OrderBy(c => c.X).ThenBy(c => c.Y);

        foreach (var cell in sorted)
        {
            writer.Write($"{cell.X} {cell.Y}\n");
        }
    }
}
