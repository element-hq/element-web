var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        "bundle": "./src/vector/index.js",

        // We ship olm.js as a separate lump of javascript. This makes it get
        // loaded via a separate <script/> tag in index.html (which loads it
        // into the browser global `Olm`), and define it as an external below.
        //
        // (we should probably make js-sdk load it asynchronously at some
        // point, so that it doesn't block the pageload, but that is a separate
        // problem)
        "olm": "./src/vector/olm-loader.js",
    },
    module: {
        preLoaders: [
            { test: /\.js$/, loader: "source-map-loader" }
        ],
        loaders: [
            { test: /\.json$/, loader: "json" },
            { test: /\.js$/, loader: "babel", include: path.resolve('./src') },
            // css-raw-loader loads CSS but doesn't try to treat url()s as require()s
            { test: /\.css$/, loader: ExtractTextPlugin.extract("css-raw-loader") },
        ],
        noParse: [
            // don't parse the languages within highlight.js. They cause stack
            // overflows (https://github.com/webpack/webpack/issues/1721), and
            // there is no need for webpack to parse them - they can just be
            // included as-is.
            /highlight\.js\/lib\/languages/,

            // olm takes ages for webpack to process, and it's already heavily
            // optimised, so there is little to gain by us uglifying it.
            /olm\/(javascript\/)?olm\.js$/,
        ],
    },
    output: {
        path: path.join(__dirname, "webapp"),
        filename: "[hash]/[name].js",
        chunkFilename: "[hash]/[name].js",
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
        }
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
        "olm": "Olm",
        // Don't try to bundle electron: leave it as a commonjs dependency
        // (the 'commonjs' here means it will output a 'require')
        "electron": "commonjs electron",
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV)
            }
        }),

        new ExtractTextPlugin(
            "[hash]/[name].css",
            {
                allChunks: true
            }
        ),

        new HtmlWebpackPlugin({
            template: './src/vector/index.html',

            // we inject the links ourselves via the template, because
            // HtmlWebpackPlugin wants to put the script tags either at the
            // bottom of <head> or the bottom of <body>, and I'm a bit scared
            // about moving them.
            inject: false,
        }),
    ],
    devtool: 'source-map',

    // configuration for the webpack-dev-server
    devServer: {
        // serve unwebpacked assets from webapp.
        contentBase: './webapp',
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
