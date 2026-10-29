using System;
using System.Linq;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using DrawingOps.Sync;

namespace DrawingOps.Revit
{
    /// <summary>"Sync sheets" (F-09): reads every sheet's number, name and current revision and
    /// sends them for DL approval. Read-only: the model is never changed.</summary>
    [Transaction(TransactionMode.ReadOnly)]
    public sealed class SyncSheetsCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData data, ref string message, ElementSet elements)
        {
            var doc = data.Application.ActiveUIDocument?.Document;
            if (doc == null) { message = "Open a model first."; return Result.Failed; }
            var settings = SettingsStore.Load(doc.Title);
            if (settings == null) return Result.Cancelled;
            try
            {
                var sheets = new FilteredElementCollector(doc)
                    .OfClass(typeof(ViewSheet))
                    .Cast<ViewSheet>()
                    .Where(s => !s.IsPlaceholder)
                    .Select(s => new SheetInfo(s.SheetNumber, s.Name, CurrentRevision(doc, s)));
                var request = new SyncRequest
                {
                    Source = "revit",
                    ModelPath = doc.PathName,
                    AppVersion = $"Revit {data.Application.Application.VersionNumber}",
                    Sheets = SheetCollector.Clean(sheets).ToList(),
                };
                var result = new DrawingOpsClient(settings).SyncAsync(request).GetAwaiter().GetResult();
                TaskDialog.Show("DrawingOps", $"Sent {request.Sheets.Count} sheets. {result.Summary()}");
                return Result.Succeeded;
            }
            catch (SyncException e)
            {
                TaskDialog.Show("DrawingOps", e.Message);
                return Result.Failed;
            }
        }

        private static string CurrentRevision(Document doc, ViewSheet sheet)
        {
            var id = sheet.GetCurrentRevision();
            if (id == ElementId.InvalidElementId) return "";
            return (doc.GetElement(id) as Autodesk.Revit.DB.Revision)?.RevisionNumber ?? "";
        }
    }
}
