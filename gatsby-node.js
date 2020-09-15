"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPostBuild = exports.onCreateWebpackConfig = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const webpack_assets_manifest_1 = __importDefault(require("webpack-assets-manifest"));
const constants_1 = require("./constants");
const headers_1 = require("./headers");
const nginx_generator_1 = require("./nginx-generator");
const assetsManifest = {};
const Node = {
    onCreateWebpackConfig({ actions, stage }) {
        if (stage !== constants_1.BUILD_HTML_STAGE) {
            return;
        }
        actions.setWebpackConfig({
            plugins: [
                new webpack_assets_manifest_1.default({
                    assets: assetsManifest,
                    merge: true
                })
            ]
        });
    },
    async onPostBuild({ store, pathPrefix, reporter }, { transformHeaders }) {
        const { program, pages: pagesMap, redirects } = store.getState();
        const pages = Array.from(pagesMap.values());
        const rewrites = pages
            .filter(page => page.matchPath && page.matchPath !== page.path)
            .map(page => ({
            fromPath: page.matchPath,
            toPath: page.path
        }));
        const assetsByChunkName = require(path_1.join(program.directory, 'public', 'webpack.stats.json')).assetsByChunkName;
        const manifest = {
            ...mapObjectValues(assetsManifest, value => [value]),
            ...assetsByChunkName
        };
        let headers = {
            ...headers_1.preloadHeadersByPath(pages, manifest, pathPrefix),
            ...headers_1.cacheHeadersByPath(pages, manifest)
        };
        if (typeof transformHeaders === 'function') {
            headers = headers_1.applyUserHeadersTransform(headers, transformHeaders);
        }
        fs_1.writeFileSync(path_1.join(program.directory, constants_1.VTEX_NGINX_CONF_FILENAME), nginx_generator_1.generateNginxConfiguration(rewrites, redirects, headers));
        reporter.success('write out nginx configuration');
    }
};
function mapObjectValues(obj, transform) {
    return Object.fromEntries(Object.entries(obj)
        .map(([k, v]) => [k, transform(v)]));
}
exports.onCreateWebpackConfig = Node.onCreateWebpackConfig;
exports.onPostBuild = Node.onPostBuild;
