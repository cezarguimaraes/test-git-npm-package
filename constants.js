"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VTEX_NGINX_CONF_FILENAME = exports.CACHING_HEADERS = exports.PAGE_DATA_DIR = exports.COMMON_BUNDLES = exports.IMMUTABLE_CACHING_HEADER = exports.BUILD_HTML_STAGE = void 0;
exports.BUILD_HTML_STAGE = 'build-html';
exports.IMMUTABLE_CACHING_HEADER = {
    name: 'Cache-Control',
    value: 'public, max-age=31536000, immutable'
};
exports.COMMON_BUNDLES = ['commons', 'app'];
exports.PAGE_DATA_DIR = 'page-data';
exports.CACHING_HEADERS = [
    ['/static/*', [exports.IMMUTABLE_CACHING_HEADER]],
    ['/sw.js', [{ name: 'Cache-Control', value: 'no-cache' }]],
];
exports.VTEX_NGINX_CONF_FILENAME = 'nginx.out.conf';
