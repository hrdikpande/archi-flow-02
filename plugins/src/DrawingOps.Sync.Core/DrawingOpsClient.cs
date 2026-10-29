using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace DrawingOps.Sync
{
    public sealed class SyncException : Exception
    {
        public SyncException(string message, HttpStatusCode? status = null) : base(message) { Status = status; }
        public HttpStatusCode? Status { get; }
    }

    /// <summary>Posts the sheet list with the user's API token (scope cad_sync:write).</summary>
    public sealed class DrawingOpsClient
    {
        public const string PluginVersion = "1.0.0";
        private readonly HttpClient _http;
        private readonly SyncSettings _settings;

        public DrawingOpsClient(SyncSettings settings, HttpMessageHandler? handler = null)
        {
            Validate(settings);
            _settings = settings;
            _http = handler == null ? new HttpClient() : new HttpClient(handler);
            _http.Timeout = TimeSpan.FromSeconds(60);
            _http.BaseAddress = new Uri(settings.ServerUrl.TrimEnd('/') + "/");
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", settings.Token.Trim());
            _http.DefaultRequestHeaders.UserAgent.ParseAdd($"DrawingOps-CAD-Sync/{PluginVersion}");
        }

        public static void Validate(SyncSettings s)
        {
            if (!Uri.TryCreate(s.ServerUrl, UriKind.Absolute, out var uri))
                throw new SyncException("Enter the DrawingOps address, e.g. https://drawings.example.com.");
            var local = uri.Host == "localhost" || uri.Host == "127.0.0.1";
            if (uri.Scheme != "https" && !local)
                throw new SyncException("The DrawingOps address must start with https:// so the token is not sent in clear text.");
            if (!s.Token.Trim().StartsWith("dop_", StringComparison.Ordinal))
                throw new SyncException("Paste the API token from DrawingOps (it starts with dop_).");
            if (string.IsNullOrWhiteSpace(s.ProjectCode))
                throw new SyncException("Enter the DrawingOps project code, e.g. 2026-014.");
        }

        public async Task<SyncResult> SyncAsync(SyncRequest request, CancellationToken ct = default)
        {
            request.ProjectCode = _settings.ProjectCode.Trim();
            request.PluginVersion = PluginVersion;
            var body = JsonSerializer.Serialize(request);
            const int attempts = 3;
            for (var attempt = 1; ; attempt++)
            {
                HttpResponseMessage response;
                try
                {
                    using var content = new StringContent(body, Encoding.UTF8, "application/json");
                    response = await _http.PostAsync("api/v1/integrations/cad-sync", content, ct).ConfigureAwait(false);
                }
                catch (HttpRequestException) when (attempt < attempts)
                {
                    await Task.Delay(TimeSpan.FromSeconds(attempt * 2), ct).ConfigureAwait(false);
                    continue;
                }
                catch (HttpRequestException e)
                {
                    throw new SyncException($"Could not reach DrawingOps: {e.Message}");
                }
                var text = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                    return JsonSerializer.Deserialize<SyncResult>(text) ?? new SyncResult();
                if ((int)response.StatusCode >= 500 && attempt < attempts)
                {
                    await Task.Delay(TimeSpan.FromSeconds(attempt * 2), ct).ConfigureAwait(false);
                    continue;
                }
                throw new SyncException(Explain(response.StatusCode, text), response.StatusCode);
            }
        }

        internal static string Explain(HttpStatusCode status, string body)
        {
            var detail = "";
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("detail", out var d))
                    detail = d.GetString() ?? "";
            }
            catch (JsonException) { }
            switch (status)
            {
                case HttpStatusCode.Unauthorized: return "The API token is wrong, expired or revoked. Ask an admin for a new one.";
                case HttpStatusCode.Forbidden: return detail.Length > 0 ? detail : "This token cannot sync sheets, or you are not on this project.";
                case HttpStatusCode.NotFound: return detail.Length > 0 ? detail : "Project not found. Check the project code.";
                default: return detail.Length > 0 ? detail : $"DrawingOps answered {(int)status}.";
            }
        }
    }
}
