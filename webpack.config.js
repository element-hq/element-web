const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

let og_image_url = process.env.RIOT_OG_IMAGE_URL;
if (!og_image_url) og_image_url = 'https://riot.im/app/themes/riot/img/logos/riot-im-logo-black-text.png';

// relative to languageHandler.js in matrix-react-sdk
let RIOT_LANGUAGES_FILE = process.env.RIOT_LANGUAGES_FILE;
if (!RIOT_LANGUAGES_FILE) {
    RIOT_LANGUAGES_FILE = "../../riot-web/webapp/i18n/languages.json";
}

module.exports = {
    entry: {
        // Load babel-polyfill first to avoid issues where some imports (namely react)
        // are potentially loaded before babel-polyfill.
        "bundle": ["babel-polyfill", "./src/vector/index.js"],
        "indexeddb-worker": "./src/vector/indexeddb-worker.js",

        "mobileguide": "./src/vector/mobile_guide/index.js",

        // CSS themes
        "theme-light": "./node_modules/matrix-react-sdk/res/themes/light/css/light.scss",
        "theme-dark": "./node_modules/matrix-react-sdk/res/themes/dark/css/dark.scss",
    },
    module: {
        rules: [
            { enforce: 'pre', test: /\.js$/, use: "source-map-loader", exclude: /node_modules/, },
            { test: /\.js$/, use: "babel-loader", include: path.resolve(__dirname, 'src') },
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
                test: /\.scss$/,
                // 1. postcss-loader turns the SCSS into normal CSS.
                // 2. css-loader turns the CSS into a JS module whose default
                //    export is a string containing the CSS, while also adding
                //    the images and fonts from CSS as Webpack inputs.
                // 3. ExtractTextPlugin turns that string into a separate asset.
                use: ExtractTextPlugin.extract({
                    use: [
                        "css-loader",
                        {
                            loader: 'postcss-loader',
                            options: {
                                config: {
                                    path: './postcss.config.js',
                                },
                            },
                        },
                    ],
                }),
            },
            {
                // this works similarly to the scss case, without postcss.
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    use: "css-loader",
                }),
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
                test: /\.(gif|png|svg|ttf|xml|ico)$/,
                // Use a content-based hash in the name so that we can set a long cache
                // lifetime for assets while still delivering changes quickly.
                oneOf: [
                    {
                        // Images referenced in CSS files
                        issuer: /\.(scss|css)$/,
                        loader: 'file-loader',
                        options: {
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
                        // Images referenced in HTML and JS files
                        loader: 'file-loader',
                        options: {
                            name: '[name].[hash:7].[ext]',
                            outputPath: getImgOutputPath,
                        },
                    },
                ],
            },
        ],
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
    },
    output: {
        path: path.join(__dirname, "webapp"),

        // The generated JS (and CSS, from the ExtractTextPlugin) are put in a
        // unique subdirectory for the build. There will only be one such
        // 'bundle' directory in the generated tarball; however, hosting
        // servers can collect 'bundles' from multiple versions into one
        // directory and symlink it into place - this allows users who loaded
        // an older version of the application to continue to access webpack
        // chunks even after the app is redeployed.
        filename: "bundles/[hash]/[name].js",
        chunkFilename: "bundles/[hash]/[name].js",
        devtoolModuleFilenameTemplate: function(info) {
            // Reading input source maps gives only relative paths here for
            // everything. Until I figure out how to fix this, this is a
            // workaround.
            // We use the relative resource path with any '../'s on the front
            // removed which gives a tree with matrix-react-sdk and vector
            // trees smashed together, but this fixes everything being under
            // various levels of '.' and '..'
            // Also, sometimes the resource path is absolute.
            return path.relative(process.cwd(), info.resourcePath).replace(/^[\/\.]*/, '');
        },
    },
    resolve: {
        alias: {
            // alias any requires to the react module to the one in our path, otherwise
            // we tend to get the react source included twice when using npm link.
            "react": path.resolve('./node_modules/react'),
            "react-dom": path.resolve('./node_modules/react-dom'),
            "react-addons-perf": path.resolve('./node_modules/react-addons-perf'),

            // same goes for js-sdk
            "matrix-js-sdk": path.resolve('./node_modules/matrix-js-sdk'),
        },
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            },
            'LANGUAGES_FILE': JSON.stringify(RIOT_LANGUAGES_FILE),
        }),
        new ExtractTextPlugin("bundles/[hash]/[name].css", {
            allChunks: true,
        }),

        new HtmlWebpackPlugin({
            template: './src/vector/index.html',

            // we inject the links ourselves via the template, because
            // HtmlWebpackPlugin wants to put the script tags either at the
            // bottom of <head> or the bottom of <body>, and I'm a bit scared
            // about moving them.
            inject: false,
            excludeChunks: ['mobileguide'],
            vars: {
                og_image_url: og_image_url,
            },
        }),
        new HtmlWebpackPlugin({
            template: './src/vector/mobile_guide/index.html',
            filename: 'mobile_guide/index.html',
            chunks: ['mobileguide'],
        }),
    ],
    devtool: 'source-map',

    // configuration for the webpack-dev-server
    devServer: {
        // serve unwebpacked assets from webapp.
        contentBase: './webapp',

        stats: {
            // don't fill the console up with a mahoosive list of modules
            chunks: false,
        },

        // hot mdule replacement doesn't work (I think we'd need react-hot-reload?)
        // so webpack-dev-server reloads the page on every update which is quite
        // tedious in Riot since that can take a while.
        hot: false,
        inline: false,
    },
};

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
