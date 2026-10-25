import WebKit

/// Liefert die Spieldateien aus dem App-Bundle unter waldwacht://app/...
/// Eigenes Schema statt file://, damit der Spielstand (localStorage) einen festen Ursprung hat.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "waldwacht"

    private static let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8", "json": "application/json; charset=utf-8",
        "png": "image/png", "svg": "image/svg+xml", "ico": "image/x-icon",
        "mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg",
        "woff2": "font/woff2", "txt": "text/plain; charset=utf-8",
    ]

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, let root = Bundle.main.resourceURL else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        var status = 200
        var body = Data()
        if file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) {
            body = data
        } else {
            status = 404
        }

        let mime = Self.mimeTypes[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let headers = ["Content-Type": mime, "Content-Length": String(body.count), "Cache-Control": "no-cache"]
        if let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) {
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(body)
            urlSchemeTask.didFinish()
        } else {
            urlSchemeTask.didFailWithError(URLError(.unknown))
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}
