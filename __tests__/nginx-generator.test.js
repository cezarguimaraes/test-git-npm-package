const { stringify, convertFromPath, validateRedirect, generateRewrites, generateRedirects } = require('../nginx-generator.js')

describe('stringify', () => {
  it('correctly stringifies nginx directives', () => {
    expect(stringify([
      { cmd: ['worker_processes', '3'] },
      {
        cmd: ['http'], children: [
          {
            cmd: ['server'], children: [
              {
                cmd: ['location', '=', '/blouse/p'], children: [
                  { cmd: ['add_header', 'x-frame-options', '"DENY"'] }
                ]
              }
            ]
          }
        ]
      }
    ])).toEqual(`worker_processes 3;
http {
  server {
    location = /blouse/p {
      add_header x-frame-options "DENY";
    }
  }
}`)
  })
})

describe('convertFromPath', () => {
  it('handles :slug', () => {
    expect(convertFromPath('/:slug/p')).toEqual('^/.*?/p')
    expect(convertFromPath('/:slug')).toEqual('^/.*?')
    expect(convertFromPath('/pt/:slug/p')).toEqual('^/pt/.*?/p')
  })

  it('handles wildcard (*)', () => {
    expect(convertFromPath('/*')).toEqual('^/.*')
    expect(convertFromPath('/pt/*')).toEqual('^/pt/.*')
  })
})

describe('validateRedirect', () => {
  it('throws when toPath is not an absolute URL', () => {
    const cases = [
      ['/api/*', '/api/:splat'],
      ['/api/*', 'www.example.com']
    ]
    cases.forEach(([fromPath, toPath]) =>
      expect(() => validateRedirect({ fromPath, toPath }))
        .toThrow(`redirect toPath "${toPath}" must be a valid absolute URL`))
  })

  it('throws if paths do not match', () => {
    expect(() => validateRedirect({
      fromPath: '/api/*',
      toPath: 'https://storecomponents.vtexcommercestable.com.br/api/v2/:splat'
    })).toThrow('redirect toPath "https://storecomponents.vtexcommercestable.com.br/api/v2/:splat" fromPath "/api/*": paths must match')
  })

  it('accepts matching paths with absolute toPath', () => {
    expect(validateRedirect({ fromPath: '/api/*', toPath: 'https://storecomponents.vtexcommercestable.com.br/api/:splat' })).toEqual(true)
  })
})

describe('generateRewrites', () => {
  it('correctly translates into NginxDirectives', () => {
    const expected = {
      cmd: ['location', '/'],
      children: [
        { cmd: ['rewrite', '^/.*?/p', '/__client-side-product__/p'] },
        { cmd: ['rewrite', '^/pt/.*?/p', '/pt/__client-side-product__/p'] },
        { cmd: ['rewrite', '^/.*', '/__client-side-search__'] },
        { cmd: ['rewrite', '^/pt/.*', '/pt/__client-side-search__'] },
        { cmd: ['return', '200'] }
      ]
    }
    expect(generateRewrites([
      { fromPath: '/:slug/p', toPath: '/__client-side-product__/p' },
      { fromPath: '/pt/:slug/p', toPath: '/pt/__client-side-product__/p' },
      { fromPath: '/*', toPath: '/__client-side-search__' },
      { fromPath: '/pt/*', toPath: '/pt/__client-side-search__' }
    ])).toEqual(expected)
  })
})

describe('generateRedirects', () => {
  it('correctly translates into NginxDirectives', () => {
    const expected = [
      {
        cmd: ["location", "~*", "^/api/.*"],
        children: [
          { cmd: ["proxy_pass", "https://storecomponents.vtexcommercestable.com.br$uri$is_args$args"] },
          { cmd: ["proxy_http_version", "1.1"] },
          { cmd: ["proxy_ssl_server_name", "on"] },
          { cmd: ["proxy_set_header", "X-Vtex-Graphql-Referer", "$proxy_host"] },
          { cmd: ["proxy_set_header", "Referer", "https://$proxy_host/$referer_path"] }
        ]
      },
      {
        cmd: ["location", "~*", "^/graphql/.*"],
        children: [
          { cmd: ["proxy_pass", "https://master--storecomponents.myvtex.com$uri$is_args$args"] },
          { cmd: ["proxy_http_version", "1.1"] },
          { cmd: ["proxy_ssl_server_name", "on"] },
          { cmd: ["proxy_set_header", "X-Vtex-Graphql-Referer", "$proxy_host"] },
          { cmd: ["proxy_set_header", "Referer", "https://$proxy_host/$referer_path"] }
        ]
      }]
    expect(generateRedirects([
      {
        fromPath: '/api/*',
        isPermanent: false,
        redirectInBrowser: false,
        toPath: 'https://storecomponents.vtexcommercestable.com.br/api/:splat',
        statusCode: 200
      },
      {
        fromPath: '/graphql/*',
        isPermanent: false,
        redirectInBrowser: false,
        toPath: 'https://master--storecomponents.myvtex.com/graphql/:splat',
        statusCode: 200
      }
    ])).toEqual(expected)
  })
})

/*
[
  rewrite ^/.*?/p.* /__client-side-product__/p/index.html last;
  rewrite ^/pt/.*?/p.* /pt/__client-side-product__/p/index.html last;
  { fromPath: '/:slug/p', toPath: '/__client-side-product__/p' },
  { fromPath: '/pt/:slug/p', toPath: '/pt/__client-side-product__/p' },
  { fromPath: '/*', toPath: '/__client-side-search__' },
  { fromPath: '/pt/*', toPath: '/pt/__client-side-search__' }
] [
  {
    fromPath: '/api/*',
    isPermanent: false,
    redirectInBrowser: false,
    toPath: 'https://storecomponents.vtexcommercestable.com.br/api/:splat',
    statusCode: 200
  },
  {
    fromPath: '/graphql/*',
    isPermanent: false,
    redirectInBrowser: false,
    toPath: 'https://master--storecomponents.myvtex.com/graphql/:splat',
    statusCode: 200
  }
]
*/

/*
worker_processes 3;
worker_rlimit_nofile 8192;
error_log /var/log/nginx_errors.log debug;
pid /var/log/nginx_run.pid;

events {
    worker_connections 1024;
}

http {
    access_log /var/log/nginx_access.log;

    map $http_referer $referer_path {
        default "";
        ~^.*?://.*?/(?<path>.*)$  $path;
    }

    server {
        # proxy_ssl_server_name on;
        listen 0.0.0.0:8080 default_server;

        resolver 8.8.8.8;

        location = /blouse/p/ {
            add_header X-Frame-Options "DENY";
            add_header X-XSS-Protection "1; mode=block";
            add_header X-Content-Type-Options "nosniff";
            add_header Referrer-Policy "same-origin";
            add_header Link "</webpack-runtime-d84d1b40e1bda24893d3.js>; rel=preload; as=script";
            add_header Link "</framework~f9ca8911-5139161e70709a742c0e.js>; rel=preload; as=script";
            add_header Link "</app~24120820-dec14f5a80177fbac8f7.js>; rel=preload; as=script";
            add_header Link "</commons~253ae210-6f947986d9c5bc2d04a1.js>; rel=preload; as=script";
            add_header Link "</8cac35445fd4b38a97cdc2aaf4f67e07c8f41020~253ae210-5e5844714e73ae45d036.js>; rel=preload; as=script";
            add_header Link "</bdc387f5d128c1734a9bb3b66726c9c8ceb85a9f~253ae210-5de9dbc51e37f2c1750e.js>; rel=preload; as=script";
            add_header Link "</f475a83f1136ea4d67e57964dd7f4d91be1c21c3~253ae210-237fedb2067f19741301.js>; rel=preload; as=script";
            add_header Link "</component---node-modules-vtex-gatsby-theme-vtex-src-templates-product-tsx~49702ae1-e8069bec7cdd0afae979.js>; rel=preload; as=script";
            add_header Link "</page-data/app-data.json>; rel=preload; as=fetch; crossorigin";
            add_header Link "</page-data/blouse/p/page-data.json>; rel=preload; as=fetch; crossorigin";
            proxy_pass https://s3.amazonaws.com/vtex-sites-storecomponents.store/cypress-sample-test/public${uri}index.html;
            # we are gonna handle error pages ourselves cuz we gud
        }

        # normalize non-file paths to always end with a /
        rewrite ^([^.]*[^/])$ $1/;

        # redirect /api
        location ~* ^/api/.*?$ {
            proxy_pass https://storecomponents.vtexcommercestable.com.br$uri$is_args$args;
        }

        # redirect graphql (not working on localhost, no idea why)
        location ~* ^/graphql/.*$ {
            proxy_pass https://storecomponents.myvtex.com$uri$is_args$args;
            proxy_http_version 1.1;
            proxy_ssl_server_name on;
            proxy_set_header X-vtex-graphql-referer $proxy_host;
            proxy_set_header referer https://$proxy_host/$referer_path;
        }

        # serve static files from s3
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|json|html|map)$ {
            try_files /dev/null @s3;
        }

        # hacky /index.html to s3
        location ~ /$ {
            rewrite (.*)/ $1/index.html;
            try_files /dev/null @s3;
        }

        # handle s3 403 -> client-side pages
        error_page 403 = @clientSideFallback;
        location @clientSideFallback {
            rewrite ^/.*?/p.* /__client-side-product__/p/index.html last;
            rewrite ^/pt/.*?/p.* /pt/__client-side-product__/p/index.html last;
            return 200;
        }

        # proxy resolved files from s3
        location @s3 {
            proxy_pass https://s3.amazonaws.com/vtex-sites-storecomponents.store/cypress-sample-test/public$uri;
            # we are gonna handle error pages ourselves cuz we gud
            proxy_intercept_errors on;
        }
    }
}
*/