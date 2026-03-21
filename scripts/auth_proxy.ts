import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

/**
 * Auth Proxy: The Vault Server
 * Acts as a secure middleman between untrusted test code and the real MetaCall API.
 * Injects the API Key safely into outgoing requests while hiding it from the test environment.
 */

const PORT = 8080;
const TARGET_HOST = 'api.metacall.io';
const API_KEY = process.env.METACALL_API_KEY;

if (!API_KEY) {
    console.error('[Auth Proxy] ERROR: METACALL_API_KEY is not set in the proxy environment.');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    // 1. Security Check: Only allow requests to the whitelist
    // Note: Since we are a local proxy, the 'Host' header might be localhost.
    // We enforce that this proxy only talks to MetaCall.

    console.log(`[Auth Proxy] Intercepted: ${req.method} ${req.url}`);

    const targetUrl = new URL(req.url || '/', `https://${TARGET_HOST}`);
    
    // 2. Prepare the Upstream Request
    const options: https.RequestOptions = {
        hostname: TARGET_HOST,
        port: 443,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
            ...req.headers,
            // 3. The Secret Injection: Add the real JWT token
            'Authorization': `jwt ${API_KEY}`,
            // Ensure the Host header matches the target
            'host': TARGET_HOST
        }
    };

    // 4. Security: Strip any incoming Authorization headers from the untrusted code
    // This prevents the PR from trying to spoof or override the key.
    delete options.headers!['authorization'];
    options.headers!['Authorization'] = `jwt ${API_KEY}`;

    const proxyReq = https.request(options, (proxyRes) => {
        // 5. Forward the response back to the test code
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error(`[Auth Proxy] Forwarding Error: ${err.message}`);
        res.writeHead(502);
        res.end('Bad Gateway: Proxy could not reach MetaCall API');
    });

    // Pipe the request body (e.g., zip files, deploy configs) to the upstream
    req.pipe(proxyReq);
});

server.listen(PORT, () => {
    console.log(`[Auth Proxy] Vault is active on http://localhost:${PORT}`);
    console.log(`[Auth Proxy] Target: https://${TARGET_HOST}`);
    console.log(`[Auth Proxy] Secret is locked and isolated.`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('[Auth Proxy] Vault closed.');
    });
});
