using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using DrawingOps.Sync;
using Xunit;

public class SheetCollectorTests
{
    [Fact]
    public void CleansTrimsDeduplicatesAndSorts()
    {
        var raw = new[]
        {
            new SheetInfo(" A-102 ", "First   Floor Plan", "p 02"),
            new SheetInfo("A-101", "Ground Floor Plan", "C01"),
            new SheetInfo("a-101", "Duplicate", "C02"),
            new SheetInfo("", "No number", ""),
            new SheetInfo("XX-000", "Placeholder", ""),
            new SheetInfo("A-103", "Third", "Rev A"),
        };
        var clean = SheetCollector.Clean(raw, n => n.StartsWith("XX"));
        Assert.Equal(new[] { "A-101", "A-102", "A-103" }, clean.Select(s => s.Number));
        Assert.Equal("First Floor Plan", clean[1].Title);
        Assert.Equal("P02", clean[1].Revision);
        Assert.Equal("", clean[2].Revision); // not a revision code
    }
}

public class ClientTests
{
    private static readonly SyncSettings Ok = new SyncSettings { ServerUrl = "https://drawings.example.com", Token = "dop_abc_secret", ProjectCode = "2026-014" };

    private sealed class Fake : HttpMessageHandler
    {
        private readonly Queue<HttpResponseMessage> _responses;
        public readonly List<HttpRequestMessage> Requests = new List<HttpRequestMessage>();
        public readonly List<string> Bodies = new List<string>();
        public Fake(params HttpResponseMessage[] r) { _responses = new Queue<HttpResponseMessage>(r); }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(request);
            Bodies.Add(request.Content == null ? "" : await request.Content.ReadAsStringAsync());
            return _responses.Dequeue();
        }
    }

    private static HttpResponseMessage Json(HttpStatusCode code, string body) =>
        new HttpResponseMessage(code) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };

    [Theory]
    [InlineData("drawings.example.com", "dop_x_y", "2026-014")]
    [InlineData("http://drawings.example.com", "dop_x_y", "2026-014")] // token in clear text
    [InlineData("https://drawings.example.com", "not-a-token", "2026-014")]
    [InlineData("https://drawings.example.com", "dop_x_y", "")]
    public void RejectsBadSettings(string url, string token, string code)
    {
        Assert.Throws<SyncException>(() => DrawingOpsClient.Validate(new SyncSettings { ServerUrl = url, Token = token, ProjectCode = code }));
    }

    [Fact]
    public void AllowsHttpForLocalDevelopment()
    {
        DrawingOpsClient.Validate(new SyncSettings { ServerUrl = "http://127.0.0.1:8080", Token = "dop_x_y", ProjectCode = "2026-014" });
    }

    [Fact]
    public async Task PostsWithBearerTokenAndParsesCounts()
    {
        var fake = new Fake(Json(HttpStatusCode.Created, "{\"id\":\"b1\",\"counts\":{\"new\":2,\"title\":1,\"revision\":0,\"matched\":7}}"));
        var client = new DrawingOpsClient(Ok, fake);
        var result = await client.SyncAsync(new SyncRequest { Source = "revit", Sheets = new List<SheetInfo> { new SheetInfo("A-101", "GF", "P01") } });
        Assert.Equal(2, result.Count("new"));
        Assert.Contains("2 new", result.Summary());
        var req = fake.Requests.Single();
        Assert.Equal("https://drawings.example.com/api/v1/integrations/cad-sync", req.RequestUri!.ToString());
        Assert.Equal("Bearer", req.Headers.Authorization!.Scheme);
        using var doc = JsonDocument.Parse(fake.Bodies.Single());
        Assert.Equal("2026-014", doc.RootElement.GetProperty("project_code").GetString());
        Assert.Equal("A-101", doc.RootElement.GetProperty("sheets")[0].GetProperty("number").GetString());
    }

    [Fact]
    public async Task RetriesServerErrorsThenSucceeds()
    {
        var fake = new Fake(Json(HttpStatusCode.BadGateway, ""), Json(HttpStatusCode.Created, "{\"id\":\"b\",\"counts\":{}}"));
        var result = await new DrawingOpsClient(Ok, fake).SyncAsync(new SyncRequest());
        Assert.Equal(2, fake.Requests.Count);
        Assert.Equal("b", result.Id);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "{}", "token is wrong")]
    [InlineData(HttpStatusCode.NotFound, "{\"detail\":\"No project with code 9999.\"}", "No project with code 9999.")]
    [InlineData(HttpStatusCode.Forbidden, "{}", "cannot sync")]
    public async Task ExplainsClientErrorsWithoutRetry(HttpStatusCode code, string body, string expected)
    {
        var fake = new Fake(Json(code, body));
        var e = await Assert.ThrowsAsync<SyncException>(() => new DrawingOpsClient(Ok, fake).SyncAsync(new SyncRequest()));
        Assert.Contains(expected, e.Message);
        Assert.Single(fake.Requests);
    }
}
