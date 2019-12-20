const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const webpack = require("webpack");

let og_image_url = process.env.RIOT_OG_IMAGE_URL;
if (!og_image_url) og_image_url = 'https://riot.im/app/themes/riot/img/logos/riot-im-logo-black-text.png';

module.exports = (env, argv) => ({
    entry: {
        "bundle": "./src/vector/index.js",
        "indexeddb-worker": "./src/vector/indexeddb-worker.js",
        "mobileguide": "./src/vector/mobile_guide/index.js",

        // CSS themes
        "theme-light": "./node_modules/matrix-react-sdk/res/themes/light/css/light.scss",
        "theme-dark": "./node_modules/matrix-react-sdk/res/themes/dark/css/dark.scss",
        "theme-light-custom": "./node_modules/matrix-react-sdk/res/themes/light-custom/css/light-custom.scss",
        "theme-dark-custom": "./node_modules/matrix-react-sdk/res/themes/dark-custom/css/dark-custom.scss",
    },

    optimization: {
        // Put all of our CSS into one useful place - this is needed for MiniCssExtractPlugin.
        // Previously we used a different extraction plugin that did this magic for us, but
        // now we need to consider that the CSS needs to be bundled up together.
        splitChunks: {
            cacheGroups: {
                styles: {
                    name: 'styles',
                    test: /\.css$/,
                    enforce: true,
                    // Do not add `chunks: 'all'` here because you'll break the app entry point.
                },
            },
        },
        minimize: argv.mode === 'production',
        minimizer: argv.mode === 'production' ? [new TerserPlugin({}), new OptimizeCSSAssetsPlugin({})] : [],
    },

    // Enable sourcemaps for debugging webpack's output.
    devtool: "source-map",

    resolve: {
        mainFields: ['matrix_main', 'matrix_browser', 'main', 'browser'],
        aliasFields: ['matrix_browser', 'browser'],
        extensions: ['.js', '.json', '.ts', '.gif', '.png'],
        alias: {
            // alias any requires to the react module to the one in our path,
            // otherwise we tend to get the react source included twice when
            // using `npm link` / `yarn link`.
            "react": path.resolve(__dirname, 'node_modules/react'),
            "react-dom": path.resolve(__dirname, 'node_modules/react-dom'),

            // same goes for js-sdk, but we also want to point at the source
            // of each SDK so we can compile it for ourselves.
            "matrix-js-sdk": path.resolve(__dirname, 'node_modules/matrix-js-sdk'),
            //"matrix-react-sdk": path.resolve(__dirname, 'node_modules/matrix-react-sdk/src'),

            "$webapp": path.resolve(__dirname, 'webapp'),
        },
    },

    module: {
        noParse: [
            // for cross platform compatibility use [\\\/] as the path separator
            // this ensures that the regex trips on both Windows and *nix

            // don't parse the languages within highlight.js. They cause stack
            // overflows (https://github.com/webpack/webpack/issues/1721), and
            // there is no need for webpack to parse them - they can just be
            // included as-is.
            /highlight\.js[\\\/]lib[\\\/]languages/,

            // olm takes ages for webpack to process, and it's already heavily
            // optimised, so there is little to gain by us uglifying it.
            /olm[\\\/](javascript[\\\/])?olm\.js$/,
        ],
        rules: [
            {
                test: /\.(ts|js)x?$/,
                //include: path.resolve(__dirname, 'src'),
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: {
                    cacheDirectory: true,
                    sourceMaps: "inline",
                    presets: [
                        ["@babel/preset-env", {
                            "targets": {
                                "browsers": [
                                    "last 2 versions",
                                ],
                                "node": 12,
                            },
                        }],
                        "@babel/preset-typescript",
                        "@babel/preset-flow",
                        "@babel/preset-react",
                    ],
                    plugins: [
                        ["@babel/plugin-proposal-decorators", {"legacy": true}],
                        "@babel/plugin-proposal-export-default-from",
                        "@babel/plugin-proposal-numeric-separator",
                        "@babel/plugin-proposal-class-properties",
                        "@babel/plugin-proposal-object-rest-spread",
                        "@babel/plugin-transform-flow-comments",
                        "@babel/plugin-syntax-dynamic-import",
                        "@babel/plugin-transform-runtime"
                    ],
                }
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {loader: 'css-loader', options: {importLoaders: 1}},
                    {
                        loader: 'postcss-loader',
                        ident: 'postcss',
                        options: {
                            plugins: () => [
                                require('postcss-preset-env')({browsers: 'last 2 versions'}),
                                require("postcss-strip-inline-comments")(),
                            ],
                        },
                    },
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {loader: 'css-loader', options: {importLoaders: 1}},
                    {
                        loader: 'postcss-loader',
                        ident: 'postcss',
                        options: {
                            plugins: () => [
                                require('postcss-preset-env')({browsers: 'last 2 versions'}),
                                require("postcss-strip-inline-comments")(),
                            ],
                            parser: "postcss-scss",
                        },
                    },
                ]
            },
            {
                test: /\.wasm$/,
                loader: "file-loader",
                type: "javascript/auto", // https://github.com/webpack/webpack/issues/6725
                options: {
                    name: '[name].[hash:7].[ext]',
                    outputPath: '.',
                },
            },
            {
                // cache-bust languages.json file placed in
                // riot-web/webapp/i18n during build by copy-res.js
                test: /\.*languages.json$/,
                type: "javascript/auto",
                loader: 'file-loader',
                options: {
                    name: 'i18n/[name].[hash:7].[ext]',
                },
            },
            {
                test: /\.(gif|png|svg|ttf|woff|woff2|xml|ico)$/,
                // Use a content-based hash in the name so that we can set a long cache
                // lifetime for assets while still delivering changes quickly.
                oneOf: [
                    {
                        // Assets referenced in CSS files
                        issuer: /\.(scss|css)$/,
                        loader: 'file-loader',
                        options: {
                            esModule: false,
                            name: '[name].[hash:7].[ext]',
                            outputPath: getImgOutputPath,
                            publicPath: function(url, resourcePath) {
                                // CSS image usages end up in the `bundles/[hash]` output
                                // directory, so we adjust the final path to navigate up
                                // twice.
                                const outputPath = getImgOutputPath(url, resourcePath);
                                return toPublicPath(path.join("../..", outputPath));
                            },
                        },
                    },
                    {
                        // Assets referenced in HTML and JS files
                        loader: 'file-loader',
                        options: {
                            esModule: false,
                            name: '[name].[hash:7].[ext]',
                            outputPath: getImgOutputPath,
                            publicPath: function(url, resourcePath) {
                                const outputPath = getImgOutputPath(url, resourcePath);
                                return toPublicPath(outputPath);
                            },
                        },
                    },
                ],
            },
        ]
    },

    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            },
        }),

        new MiniCssExtractPlugin({
            filename: 'bundles/[hash]/[name].css',
            ignoreOrder: false, // Enable to remove warnings about conflicting order
        }),

        new HtmlWebpackPlugin({
            template: './src/vector/index.html',

            // we inject the links ourselves via the template, because
            // HtmlWebpackPlugin will screw up our formatting like the names
            // of the themes and which chunks we actually care about.
            inject: false,
            excludeChunks: ['mobileguide'],
            minify: argv.mode === 'production',
            vars: {
                og_image_url: og_image_url,
            },
        }),

        new HtmlWebpackPlugin({
            template: './src/vector/mobile_guide/index.html',
            filename: 'mobile_guide/index.html',
            minify: argv.mode === 'production',
            chunks: ['mobileguide'],
        }),
    ],

    output: {
        path: path.join(__dirname, "webapp"),

        // The generated JS (and CSS, from the extraction plugin) are put in a
        // unique subdirectory for the build. There will only be one such
        // 'bundle' directory in the generated tarball; however, hosting
        // servers can collect 'bundles' from multiple versions into one
        // directory and symlink it into place - this allows users who loaded
        // an older version of the application to continue to access webpack
        // chunks even after the app is redeployed.
        filename: "bundles/[hash]/[name].js",
        chunkFilename: "bundles/[hash]/[name].js",
    },

    // configuration for the webpack-dev-server
    devServer: {
        // serve unwebpacked assets from webapp.
        contentBase: './webapp',

        stats: {
            // don't fill the console up with a mahoosive list of modules
            chunks: false,
        },

        // hot module replacement doesn't work (I think we'd need react-hot-reload?)
        // so webpack-dev-server reloads the page on every update which is quite
        // tedious in Riot since that can take a while.
        hot: false,
        inline: false,
    },
});

/**
 * Merge assets found via CSS and imports into a single tree, while also preserving
 * directories under `res`.
 *
 * @param {string} url The adjusted name of the file, such as `warning.1234567.svg`.
 * @param {string} resourcePath The absolute path to the source file with unmodified name.
 * @return {string} The returned paths will look like `img/warning.1234567.svg`.
 */
function getImgOutputPath(url, resourcePath) {
    const prefix = /^.*[/\\]res[/\\]/;
    const outputDir = path.dirname(resourcePath).replace(prefix, "");
    return path.join(outputDir, path.basename(url));
}

/**
 * Convert path to public path format, which always uses forward slashes, since it will
 * be placed directly into things like CSS files.
 *
 * @param {string} path Some path to a file.
 */
function toPublicPath(path) {
    return path.replace(/\\/g, '/');
}
