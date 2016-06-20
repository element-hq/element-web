var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
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
        ],
    },
    output: {
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
            react: path.resolve('./node_modules/react'),
            "react-addons-perf": path.resolve('./node_modules/react-addons-perf'),

            // same goes for js-sdk
            "matrix-js-sdk": path.resolve('./node_modules/matrix-js-sdk'),
        },
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV)
            }
        }),

        new ExtractTextPlugin("bundle.css", {
            allChunks: true
        }),

        // olm.js includes "require 'fs'", which is never
        // executed in the browser. Ignore it.
        new webpack.IgnorePlugin(/^fs$/, /\/olm$/)
    ],
    devtool: 'source-map'
};

// ignore olm.js if it's not installed, to avoid a scary-looking error.
try {
    require('olm');
    console.log("Olm is installed; including it in webpack bundle");
} catch (e) {
    module.exports.plugins.push(
        new webpack.IgnorePlugin(/^olm$/)
    );
}
