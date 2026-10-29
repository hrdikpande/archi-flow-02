using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DrawingOps.Sync;

namespace DrawingOps.Revit
{
    /// <summary>Per-user settings in %APPDATA%\DrawingOps; the token is encrypted with Windows
    /// DPAPI for the current user, so it never sits in plain text on disk.</summary>
    public static class SettingsStore
    {
        private static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DrawingOps");
        private static string FileFor(string model) => Path.Combine(Dir, "settings.json");

        public static SyncSettings? Load(string modelTitle)
        {
            var file = FileFor(modelTitle);
            if (!File.Exists(file)) { SetupDialog.Show(file); return null; }
            var stored = JsonSerializer.Deserialize<Stored>(File.ReadAllText(file)) ?? new Stored();
            var token = Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(stored.Token), null, DataProtectionScope.CurrentUser));
            return new SyncSettings { ServerUrl = stored.ServerUrl, ProjectCode = stored.ProjectCode, Token = token };
        }

        public static void Save(SyncSettings s)
        {
            DrawingOpsClient.Validate(s);
            Directory.CreateDirectory(Dir);
            var token = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(s.Token), null, DataProtectionScope.CurrentUser));
            File.WriteAllText(FileFor(""), JsonSerializer.Serialize(new Stored { ServerUrl = s.ServerUrl, ProjectCode = s.ProjectCode, Token = token }));
        }

        private sealed class Stored
        {
            public string ServerUrl { get; set; } = "";
            public string ProjectCode { get; set; } = "";
            public string Token { get; set; } = "";
        }
    }

    internal static class SetupDialog
    {
        public static void Show(string file) =>
            Autodesk.Revit.UI.TaskDialog.Show("DrawingOps",
                "Set up DrawingOps first: run 'DrawingOps settings' and enter the address, project code and API token " +
                "(Admin › Integrations › API tokens, scope 'CAD sync').");
    }
}
