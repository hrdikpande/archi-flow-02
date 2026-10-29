using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Runtime;
using DrawingOps.Sync;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Application;

[assembly: CommandClass(typeof(DrawingOps.AutoCAD.SyncSheetsCommand))]

namespace DrawingOps.AutoCAD
{
    /// <summary>DOPSYNC (F-09 / I-03): reads the title block on every paper-space layout (or each
    /// sheet DWG of a sheet set opened in turn) and posts number, title and revision for DL
    /// approval. Title-block attribute tags are configurable; defaults follow common Indian
    /// practice (SHEET_NO / DWG_NO, TITLE, REV).</summary>
    public sealed class SyncSheetsCommand
    {
        public static readonly string[] NumberTags = { "SHEET_NO", "SHEETNO", "DWG_NO", "DRAWING_NO", "SHEET_NUMBER" };
        public static readonly string[] TitleTags = { "TITLE", "DWG_TITLE", "SHEET_TITLE", "DRAWING_TITLE" };
        public static readonly string[] RevisionTags = { "REV", "REVISION", "REV_NO" };

        [CommandMethod("DOPSYNC")]
        public void Sync()
        {
            var doc = AcApp.DocumentManager.MdiActiveDocument;
            var ed = doc.Editor;
            var settings = Settings.Load();
            if (settings == null) { ed.WriteMessage("\nRun DOPSETTINGS first (address, project code, API token)."); return; }
            try
            {
                var sheets = ReadTitleBlocks(doc.Database);
                var request = new SyncRequest
                {
                    Source = "autocad",
                    ModelPath = doc.Name,
                    AppVersion = $"AutoCAD {AcApp.Version}",
                    Sheets = SheetCollector.Clean(sheets).ToList(),
                };
                var result = new DrawingOpsClient(settings).SyncAsync(request).GetAwaiter().GetResult();
                ed.WriteMessage($"\nDrawingOps: sent {request.Sheets.Count} sheets. {result.Summary()}");
            }
            catch (SyncException e)
            {
                ed.WriteMessage($"\nDrawingOps: {e.Message}");
            }
        }

        public static IEnumerable<SheetInfo> ReadTitleBlocks(Database db)
        {
            var found = new List<SheetInfo>();
            using var tr = db.TransactionManager.StartOpenCloseTransaction();
            var layouts = (DBDictionary)tr.GetObject(db.LayoutDictionaryId, OpenMode.ForRead);
            foreach (DBDictionaryEntry entry in layouts)
            {
                var layout = (Layout)tr.GetObject(entry.Value, OpenMode.ForRead);
                if (layout.ModelType) continue;
                var space = (BlockTableRecord)tr.GetObject(layout.BlockTableRecordId, OpenMode.ForRead);
                foreach (ObjectId id in space)
                {
                    if (!(tr.GetObject(id, OpenMode.ForRead) is BlockReference block)) continue;
                    var attrs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (ObjectId a in block.AttributeCollection)
                        if (tr.GetObject(a, OpenMode.ForRead) is AttributeReference ar) attrs[ar.Tag] = ar.TextString;
                    var number = First(attrs, NumberTags);
                    if (number.Length == 0) continue;
                    found.Add(new SheetInfo(number, First(attrs, TitleTags), First(attrs, RevisionTags)));
                    break; // one title block per layout
                }
            }
            return found;
        }

        private static string First(IDictionary<string, string> attrs, IEnumerable<string> tags) =>
            tags.Select(t => attrs.TryGetValue(t, out var v) ? v : "").FirstOrDefault(v => v.Length > 0) ?? "";
    }

    internal static class Settings
    {
        public static SyncSettings? Load()
        {
            var path = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DrawingOps", "settings.json");
            if (!System.IO.File.Exists(path)) return null;
            var json = System.Text.Json.JsonDocument.Parse(System.IO.File.ReadAllText(path)).RootElement;
            var token = System.Text.Encoding.UTF8.GetString(System.Security.Cryptography.ProtectedData.Unprotect(
                Convert.FromBase64String(json.GetProperty("Token").GetString() ?? ""), null,
                System.Security.Cryptography.DataProtectionScope.CurrentUser));
            return new SyncSettings
            {
                ServerUrl = json.GetProperty("ServerUrl").GetString() ?? "",
                ProjectCode = json.GetProperty("ProjectCode").GetString() ?? "",
                Token = token,
            };
        }
    }
}
