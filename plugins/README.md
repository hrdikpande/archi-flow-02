# DrawingOps CAD plugins (I-03, I-04, F-09)

| Project | What | Builds where |
|---|---|---|
| `src/DrawingOps.Sync.Core` | Shared client: cleans the sheet list, posts it with the user's API token, explains errors | Anywhere (`netstandard2.0`); tested in CI |
| `src/DrawingOps.Revit` | Revit add-in command "Sync sheets to DrawingOps" (read-only transaction) | Windows with Revit (`-p:RevitVersion=2024`) |
| `src/DrawingOps.AutoCAD` | AutoCAD command `DOPSYNC`, reads title-block attributes on each layout | Windows with AutoCAD (`-p:AcadVersion=2024`) |

The plugins only **propose** sheets: a project or discipline lead accepts or rejects them on the
project's **CAD sync** page. Nothing in the model is changed.

* Token: Admin › Integrations › API tokens, scope **CAD sync**. Stored per Windows user with DPAPI.
* Address must be `https://` (plain `http://` only for `localhost`).
* Autodesk API DLLs are referenced from the local install and never committed.

```bash
make plugins   # restore, build and test the core in the .NET 8 SDK container
```
