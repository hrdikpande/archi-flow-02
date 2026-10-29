"""HTML to PDF for every generated document (cover sheets, watermarks, stamps, reports, exports).

External resources are refused: images arrive as data: URIs built by the server, so no template
or user text can make WeasyPrint fetch a URL or read a local file (SSRF / file disclosure)."""


def render_pdf(html: str) -> bytes:
    from weasyprint import HTML  # imported lazily: needs Pango (in the Docker image)
    from weasyprint.urls import URLFetcher

    fetcher = URLFetcher(allowed_protocols={"data"}, allow_redirects=False)
    pdf: bytes = HTML(string=html, url_fetcher=fetcher).write_pdf()
    return pdf
