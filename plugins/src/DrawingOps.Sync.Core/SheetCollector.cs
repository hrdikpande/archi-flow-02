using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace DrawingOps.Sync
{
    /// <summary>Cleans what the CAD host reads before it is sent: trims, drops blanks and
    /// placeholder sheets, de-duplicates by number (first wins) and normalises revision codes.</summary>
    public static class SheetCollector
    {
        private static readonly Regex Spaces = new Regex(@"\s+", RegexOptions.Compiled);
        private static readonly Regex RevisionCode = new Regex(@"^[A-Z]{1,2}\d{1,3}$", RegexOptions.Compiled);

        public static IReadOnlyList<SheetInfo> Clean(IEnumerable<SheetInfo> raw, Func<string, bool>? isPlaceholder = null)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new List<SheetInfo>();
            foreach (var s in raw)
            {
                var number = Normalise(s.Number);
                if (number.Length == 0 || number.Length > 40) continue;
                if (isPlaceholder != null && isPlaceholder(number)) continue;
                if (!seen.Add(number)) continue;
                var title = Normalise(s.Title);
                if (title.Length > 300) title = title.Substring(0, 300);
                result.Add(new SheetInfo(number, title, NormaliseRevision(s.Revision)));
            }
            return result.OrderBy(s => s.Number, StringComparer.OrdinalIgnoreCase).ToList();
        }

        public static string Normalise(string? text) => Spaces.Replace(text ?? "", " ").Trim();

        /// <summary>"p 02", "p02 " → "P02"; anything that is not a revision code is sent empty.</summary>
        public static string NormaliseRevision(string? text)
        {
            var code = Spaces.Replace(text ?? "", "").ToUpperInvariant();
            return RevisionCode.IsMatch(code) ? code : "";
        }
    }
}
