import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys

PORT = 7070
DIRECTORY = "web"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/proxy/'):
            # The target URL is everything after /proxy/
            target_url = self.path[len('/proxy/'):]
            
            try:
                # Add a User-Agent header and forward the request
                req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
                response = urllib.request.urlopen(req, timeout=10)
                
                # Send response status code
                self.send_response(response.getcode())
                
                # Relay headers from the target response
                for key, value in response.info().items():
                    if key.lower() not in ['transfer-encoding', 'connection']:
                        self.send_header(key, value)
                
                # Add CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                # Send the response body
                self.wfile.write(response.read())
                
            except urllib.error.URLError as e:
                status_code = getattr(e, 'code', 502)
                reason = getattr(e, 'reason', str(e))
                print(f"Proxy error for {target_url}: {status_code} {reason}")
                
                self.send_response(status_code)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"Proxy Error: {reason}".encode('utf-8'))
            except Exception as e:
                print(f"Unexpected error for {target_url}: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"Internal Server Error: {str(e)}".encode('utf-8'))
        else:
            # Not a proxy request, serve static files as usual
            super().do_GET()

if __name__ == "__main__":
    if not os.path.exists(DIRECTORY):
        print(f"Error: Directory '{DIRECTORY}' not found. Please run this script from the root of the leanviz repository.")
        sys.exit(1)
        
    Handler = ProxyHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"Proxying requests prefixed with /proxy/ to destination URLs (e.g., http://localhost:{PORT}/proxy/http://example.com)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()
