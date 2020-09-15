"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyUserHeadersTransform = exports.cacheHeadersByPath = exports.preloadHeadersByPath = void 0;
const path_1 = require("path");
const kebab_hash_1 = __importDefault(require("kebab-hash"));
const constants_1 = require("./constants");
function preloadHeadersByPath(pages, manifest, pathPrefix) {
    return Object.fromEntries(pages.map(page => {
        const scripts = [].concat(...constants_1.COMMON_BUNDLES.map(file => getScriptsPaths(file, manifest)));
        scripts.push(...getScriptsPaths(pathChunkName(page.path), manifest));
        scripts.push(...getScriptsPaths(page.componentChunkName, manifest));
        const json = [
            path_1.posix.join(constants_1.PAGE_DATA_DIR, 'app-data.json'),
            getPageDataPath(page.path)
        ];
        return [
            normalizePath(pathPrefix + page.path),
            [
                ...scripts.filter(Boolean).map(script => ({
                    name: 'Link',
                    value: linkTemplate(script, pathPrefix)
                })),
                ...json.map(json => ({
                    name: 'Link',
                    value: linkTemplate(json, pathPrefix, 'fetch')
                }))
            ]
        ];
    }));
}
exports.preloadHeadersByPath = preloadHeadersByPath;
function cacheHeadersByPath(pages, manifest) {
    const chunks = pages.map(page => page.componentChunkName);
    chunks.push(`pages-manifest`, `app`);
    const files = [].concat(...chunks.map(chunk => manifest[chunk] || []));
    return Object.fromEntries(files.map(file => ['/' + file, [constants_1.IMMUTABLE_CACHING_HEADER]])
        .concat(constants_1.CACHING_HEADERS));
}
exports.cacheHeadersByPath = cacheHeadersByPath;
// removes trailing slash if possible
function normalizePath(path) {
    if (!path.endsWith('/') || path === '/') {
        return path;
    }
    return path.slice(0, -1);
}
function getScriptsPaths(file, manifest) {
    const chunks = manifest[file];
    if (!chunks) {
        return [];
    }
    return chunks.filter(script => path_1.parse(script).ext === '.js');
}
function linkTemplate(asset, pathPrefix, type = 'script') {
    return `<${pathPrefix}/${asset}>; rel=preload; as=${type}${type === 'fetch' ? '; crossorigin' : ''}`;
}
function pathChunkName(path) {
    const name = path === '/' ? 'index' : kebab_hash_1.default(path);
    return `path---${name}`;
}
function getPageDataPath(path) {
    const fixedPagePath = path === `/` ? `index` : path;
    return path_1.posix.join(constants_1.PAGE_DATA_DIR, fixedPagePath, `page-data.json`);
}
function applyUserHeadersTransform(headersMap, transform) {
    return Object.fromEntries(Object.entries(headersMap)
        .map(([path, headers]) => {
        const headersAsStrings = headers.map(({ name, value }) => `${name}: ${value}`);
        return [
            path,
            transform(headersAsStrings, path).map(headerFromString)
        ];
    }));
}
exports.applyUserHeadersTransform = applyUserHeadersTransform;
function headerFromString(header) {
    const [name, ...rest] = header.split(':');
    return {
        name,
        value: rest.join('').trim()
    };
}
