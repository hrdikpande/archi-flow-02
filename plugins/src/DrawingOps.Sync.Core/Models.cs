using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DrawingOps.Sync
{
    /// <summary>One sheet as the model sees it: number, title, revision on the title block.</summary>
    public sealed class SheetInfo
    {
        public SheetInfo(string number, string title, string revision)
        {
            Number = number;
            Title = title;
            Revision = revision;
        }

        [JsonPropertyName("number")] public string Number { get; }
        [JsonPropertyName("title")] public string Title { get; }
        [JsonPropertyName("revision")] public string Revision { get; }
    }

    /// <summary>Body of POST /api/v1/integrations/cad-sync (F-09).</summary>
    public sealed class SyncRequest
    {
        [JsonPropertyName("project_code")] public string ProjectCode { get; set; } = "";
        [JsonPropertyName("source")] public string Source { get; set; } = "revit";
        [JsonPropertyName("model_path")] public string ModelPath { get; set; } = "";
        [JsonPropertyName("app_version")] public string AppVersion { get; set; } = "";
        [JsonPropertyName("plugin_version")] public string PluginVersion { get; set; } = "";
        [JsonPropertyName("sheets")] public IList<SheetInfo> Sheets { get; set; } = new List<SheetInfo>();
    }

    /// <summary>What the server proposed; nothing is created until a DL accepts (F-09).</summary>
    public sealed class SyncResult
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("counts")] public Dictionary<string, int> Counts { get; set; } = new Dictionary<string, int>();

        public int Count(string key) => Counts.TryGetValue(key, out var n) ? n : 0;

        public string Summary() =>
            $"{Count("new")} new, {Count("title")} title differences, {Count("revision")} revision differences, " +
            $"{Count("matched")} matched. A project or discipline lead reviews the proposals in DrawingOps.";
    }

    /// <summary>Where and as whom to sync. Stored per user by the host plugin.</summary>
    public sealed class SyncSettings
    {
        public string ServerUrl { get; set; } = "";
        public string Token { get; set; } = "";
        public string ProjectCode { get; set; } = "";
    }
}
