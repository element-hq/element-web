const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

let og_image_url = process.env.RIOT_OG_IMAGE_URL;
if (!og_image_url) og_image_url = 'https://riot.im/app/themes/riot/img/logos/riot-im-logo-1.png';

module.exports = {
    entry: {
        // Load babel-polyfill first to avoid issues where some imports (namely react)
        // are potentially loaded before babel-polyfill.
        "bundle": ["babel-polyfill", "./src/vector/index.js"],
        "indexeddb-worker": "./src/vector/indexeddb-worker.js",

        "mobileguide": "./src/vector/mobile_guide/index.js",

        // We ship olm.js as a separate lump of javascript. This makes it get
        // loaded via a separate <script/> tag in index.html (which loads it
        // into the browser global `Olm`, where js-sdk expects to find it).
        //
        // (we should probably make js-sdk load it asynchronously at some
        // point, so that it doesn't block the pageload, but that is a separate
        // problem)
        "olm": "./src/vector/olm-loader.js",

        // CSS themes
        "theme-light":  "./node_modules/matrix-react-sdk/res/themes/light/css/light.scss",
        "theme-dark":   "./node_modules/matrix-react-sdk/res/themes/dark/css/dark.scss",
        "theme-dharma": "./node_modules/matrix-react-sdk/res/themes/dharma/css/dharma.scss",
        "theme-status": "./res/themes/status/css/status.scss",
    },
    module: {
        rules: [
            { enforce: 'pre', test: /\.js$/, use: "source-map-loader", exclude: /node_modules/, },
            { test: /\.js$/, use: "babel-loader", include: path.resolve(__dirname, 'src') },
            {
                test: /\.scss$/,
                // 1. postcss-loader turns the SCSS into normal CSS.
                // 2. raw-loader turns the CSS into a javascript module
                //    whose default export is a string containing the CSS.
                //    (raw-loader is similar to css-loader, but the latter
                //    would also drag in the imgs and fonts that our CSS refers to
                //    as webpack inputs.)
                // 3. ExtractTextPlugin turns that string into a separate asset.
                use: ExtractTextPlugin.extract({
                    use: [
                        "raw-loader",
                        {
                            loader: 'postcss-loader',
                            options: {
                                config: {
                                    path: './postcss.config.js'
                                }
                            }
                        }
                    ],
                }),
            },
            {
                // this works similarly to the scss case, without postcss.
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    use: "raw-loader"
                }),
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

        // the generated js (and CSS, from the ExtractTextPlugin) are put in a
        // unique subdirectory for the build. There will only be one such
        // 'bundle' directory in the generated tarball; however, hosting
        // servers can collect 'bundles' from multiple versions into one
        // directory and symlink it into place - this allows users who loaded
        // an older version of the application to continue to access webpack
        // chunks even after the app is redeployed.
        //
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
    externals: {
        // Don't try to bundle electron: leave it as a commonjs dependency
        // (the 'commonjs' here means it will output a 'require')
        "electron": "commonjs electron",
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            },
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
    },
};

// olm is an optional dependency. Ignore it if it's not installed, to avoid a
// scary-looking error.
try {
    require('olm');
} catch (e) {
    console.log("Olm is not installed; not shipping it");
    delete(module.exports.entry["olm"]);
}
