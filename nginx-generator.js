"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNginxConfiguration = exports.generatePathLocation = exports.generateRedirects = exports.generateRewrites = exports.validateRedirect = exports.convertFromPath = exports.stringify = void 0;
const path_1 = require("path");
function generateNginxConfiguration(rewrites, redirects, headersMap) {
    return stringify([
        { cmd: ['worker_processes', '3'] },
        { cmd: ['worker_rlimit_nofile', '8192'] },
        { cmd: ['error_log', '/var/log/nginx_errors.log', 'debug'] },
        { cmd: ['pid', '/var/log/nginx_run.pid'] },
        { cmd: ['events'], children: [{ cmd: ['worker_connections', '1024'] }] },
        {
            cmd: ['http'], children: [
                { cmd: ['access_log', '/var/log/nginx_access.log'] },
                {
                    cmd: ['map', '$http_referer', '$referer_path'], children: [
                        { cmd: ['default', '""'] },
                        { cmd: ['~^.*?://.*?/(?<path>.*)$', '$path'] }
                    ],
                },
                {
                    cmd: ['server'], children: [
                        { cmd: ['listen', '0.0.0.0:8080', 'default_server'] },
                        { cmd: ['resolver', '1.1.1.1'] },
                        ...Object.entries(headersMap).map(([path, headers]) => generatePathLocation(path, headers)),
                        ...generateRedirects(redirects),
                        generateRewrites(rewrites),
                    ],
                },
            ],
        },
    ]);
}
exports.generateNginxConfiguration = generateNginxConfiguration;
function stringify(directives) {
    return directives.map(({ cmd, children }) => `${cmd.join(' ')}${children ? ` {\n${ident(stringify(children))}\n}` : ';'}`)
        .join('\n');
}
exports.stringify = stringify;
function convertFromPath(path) {
    return '^' + path
        .replace(/\*/g, '.*') // order matters!
        .replace(/:slug/g, '.*?');
}
exports.convertFromPath = convertFromPath;
function validateRedirect({ fromPath, toPath }) {
    let url;
    try {
        url = new URL(toPath);
    }
    catch (ex) {
        throw new Error(`redirect toPath "${toPath}" must be a valid absolute URL`);
    }
    if (fromPath.replace(/\*/g, ':splat') !== url.pathname) {
        throw new Error(`redirect toPath "${toPath}" fromPath "${fromPath}": paths must match`);
    }
    return true;
}
exports.validateRedirect = validateRedirect;
function generateRewrites(rewrites) {
    return {
        cmd: ['location', '/'],
        children: rewrites.map(({ fromPath, toPath }) => ({
            cmd: [
                'rewrite',
                convertFromPath(fromPath),
                toPath
            ]
        })).concat([{ cmd: ['return', '200'] }])
    };
}
exports.generateRewrites = generateRewrites;
function generateRedirects(redirects) {
    return redirects.map(redirect => {
        validateRedirect(redirect);
        const { fromPath, toPath } = redirect;
        const { protocol, host } = new URL(toPath);
        return {
            cmd: ['location', '~*', convertFromPath(fromPath)],
            children: [
                { cmd: ['proxy_pass', `${protocol}//${host}$uri$is_args$args`] },
                { cmd: ['proxy_http_version', '1.1'] },
                { cmd: ['proxy_ssl_server_name', 'on'] },
                { cmd: ['proxy_set_header', 'X-Vtex-Graphql-Referer', '$proxy_host'] },
                { cmd: ['proxy_set_header', 'Referer', `${protocol}//$proxy_host/$referer_path`] },
            ]
        };
    });
}
exports.generateRedirects = generateRedirects;
function generatePathLocation(path, headers) {
    return {
        cmd: ['location', '=', path],
        children: [
            ...headers.map(({ name, value }) => ({ cmd: ['add_header', name, `"${value}"`] })),
            { cmd: ['proxy_pass', `https://s3.amazonaws.com/vtex-sites-storecomponents.store/cypress-sample-test/public${fixFilePath(path)}`] }
        ]
    };
}
exports.generatePathLocation = generatePathLocation;
function fixFilePath(path) {
    if (path.indexOf('.') !== -1) {
        return path;
    }
    return path_1.posix.join(path, 'index.html');
}
function ident(text, space = '  ') {
    return text.split('\n').map(line => `${space}${line}`).join('\n');
}