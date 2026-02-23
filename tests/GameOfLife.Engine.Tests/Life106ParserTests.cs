using GameOfLife.Engine.Models;
using GameOfLife.Engine.Services;

namespace GameOfLife.Engine.Tests;

public class Life106ParserTests
{
    [Fact]
    public void Parse_ValidInput_ReturnsCorrectCells()
    {
        var input = "#Life 1.06\n0 1\n1 2\n2 0\n2 1\n2 2\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(0, invalidLines);
        Assert.Equal(5, cells.Count);
        Assert.Contains(new Cell(0, 1), cells);
        Assert.Contains(new Cell(1, 2), cells);
        Assert.Contains(new Cell(2, 0), cells);
        Assert.Contains(new Cell(2, 1), cells);
        Assert.Contains(new Cell(2, 2), cells);
    }

    [Fact]
    public void Parse_LargeCoordinates_ParsesCorrectly()
    {
        var input = "#Life 1.06\n-2000000000000 -2000000000000\n-2000000000001 -2000000000001\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(0, invalidLines);
        Assert.Equal(2, cells.Count);
        Assert.Contains(new Cell(-2000000000000, -2000000000000), cells);
        Assert.Contains(new Cell(-2000000000001, -2000000000001), cells);
    }

    [Fact]
    public void Parse_EmptyInput_ReturnsEmpty()
    {
        var (cells, invalidLines) = Life106Parser.Parse("");
        Assert.Empty(cells);
        Assert.Equal(0, invalidLines);
    }

    [Fact]
    public void Parse_OnlyHeader_ReturnsEmpty()
    {
        var (cells, invalidLines) = Life106Parser.Parse("#Life 1.06\n");
        Assert.Empty(cells);
        Assert.Equal(0, invalidLines);
    }

    [Fact]
    public void Parse_SkipsCommentLines()
    {
        var input = "#Life 1.06\n# This is a comment\n0 0\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(0, invalidLines);
        Assert.Single(cells);
        Assert.Contains(new Cell(0, 0), cells);
    }

    [Fact]
    public void Parse_SkipsMalformedStructuralLines()
    {
        // Lines with wrong token count (not 2) are silently skipped — not counted as invalid.
        var input = "#Life 1.06\nnot a cell\n0 0\n1 2 3\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(0, invalidLines);
        Assert.Single(cells);
        Assert.Contains(new Cell(0, 0), cells);
    }

    [Fact]
    public void Parse_OutOfRangeCoordinate_CountsAsInvalidLine()
    {
        // 9223372036854775898 exceeds long.MaxValue — two-token line that fails long.TryParse.
        var input = "#Life 1.06\n0 1\n9223372036854775898 0\n1 2\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(1, invalidLines);
        Assert.Equal(2, cells.Count); // only the two valid cells
        Assert.Contains(new Cell(0, 1), cells);
        Assert.Contains(new Cell(1, 2), cells);
    }

    [Fact]
    public void Parse_NonIntegerCoordinate_CountsAsInvalidLine()
    {
        var input = "#Life 1.06\n0 0\nabc def\n1 1\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(1, invalidLines);
        Assert.Equal(2, cells.Count);
    }

    [Fact]
    public void Parse_TextReader_WorksCorrectly()
    {
        var input = "#Life 1.06\n0 0\n1 1\n";
        using var reader = new StringReader(input);
        var (cells, invalidLines) = Life106Parser.Parse(reader);

        Assert.Equal(0, invalidLines);
        Assert.Equal(2, cells.Count);
        Assert.Contains(new Cell(0, 0), cells);
        Assert.Contains(new Cell(1, 1), cells);
    }

    [Fact]
    public void Parse_TextReader_OutOfRangeCoordinate_CountsAsInvalidLine()
    {
        var input = "#Life 1.06\n0 0\n9223372036854775898 0\n";
        using var reader = new StringReader(input);
        var (cells, invalidLines) = Life106Parser.Parse(reader);

        Assert.Equal(1, invalidLines);
        Assert.Single(cells);
    }

    [Fact]
    public void Serialize_ProducesValidOutput()
    {
        var cells = new HashSet<Cell>
        {
            new(2, 1), new(0, 0)
        };

        var output = Life106Parser.Serialize(cells);

        Assert.StartsWith("#Life 1.06", output);
        Assert.Contains("0 0", output);
        Assert.Contains("2 1", output);
    }

    [Fact]
    public void Serialize_SortsByXThenY()
    {
        var cells = new HashSet<Cell>
        {
            new(2, 1), new(0, 3), new(0, 1)
        };

        var output = Life106Parser.Serialize(cells);
        var lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("#Life 1.06", lines[0]);
        Assert.Equal("0 1", lines[1]);
        Assert.Equal("0 3", lines[2]);
        Assert.Equal("2 1", lines[3]);
    }

    [Fact]
    public void Serialize_LargeCoordinates_FormatsCorrectly()
    {
        var cells = new HashSet<Cell>
        {
            new(-2000000000000, -2000000000000)
        };

        var output = Life106Parser.Serialize(cells);
        Assert.Contains("-2000000000000 -2000000000000", output);
    }

    [Fact]
    public void RoundTrip_ParseThenSerializeThenParse_ProducesSameResult()
    {
        var input = "#Life 1.06\n-2000000000000 -2000000000000\n0 1\n1 2\n2 0\n2 1\n2 2\n";
        var (cells, _) = Life106Parser.Parse(input);
        var serialized = Life106Parser.Serialize(cells);
        var (roundTripped, invalidLines) = Life106Parser.Parse(serialized);

        Assert.Equal(0, invalidLines);
        Assert.Equal(cells, roundTripped);
    }

    [Fact]
    public void Serialize_EmptySet_ReturnsHeaderOnly()
    {
        var output = Life106Parser.Serialize(new HashSet<Cell>());
        var trimmed = output.Trim();
        Assert.Equal("#Life 1.06", trimmed);
    }

    [Fact]
    public void Serialize_TextWriter_WritesCorrectly()
    {
        var cells = new HashSet<Cell> { new(0, 0), new(1, 1) };
        using var writer = new StringWriter();
        Life106Parser.Serialize(cells, writer);

        var output = writer.ToString();
        Assert.Contains("#Life 1.06", output);
        Assert.Contains("0 0", output);
        Assert.Contains("1 1", output);
    }

    [Fact]
    public void Parse_WindowsLineEndings_ParsesCorrectly()
    {
        // CRLF input must parse identically to LF input
        var input = "#Life 1.06\r\n0 1\r\n1 2\r\n";
        var (cells, invalidLines) = Life106Parser.Parse(input);

        Assert.Equal(0, invalidLines);
        Assert.Equal(2, cells.Count);
        Assert.Contains(new Cell(0, 1), cells);
        Assert.Contains(new Cell(1, 2), cells);
    }

    [Fact]
    public void Serialize_UsesUnixLineEndings()
    {
        // AppendLine emits \r\n on Windows; we explicitly use \n to produce canonical Life 1.06
        var cells = new HashSet<Cell> { new(0, 0), new(1, 1) };
        var output = Life106Parser.Serialize(cells);

        Assert.DoesNotContain('\r', output);
        Assert.Contains('\n', output);
    }

    [Fact]
    public void Serialize_TextWriter_UsesUnixLineEndings()
    {
        var cells = new HashSet<Cell> { new(0, 0) };
        using var writer = new StringWriter();
        Life106Parser.Serialize(cells, writer);

        var output = writer.ToString();
        Assert.DoesNotContain('\r', output);
        Assert.Contains('\n', output);
    }
}
