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

        // CSS themes
        "theme-light": "./src/skins/vector/css/themes/light.scss",
        "theme-dark": "./src/skins/vector/css/themes/dark.scss",

    },
    module: {
        preLoaders: [
            { test: /\.js$/, loader: "source-map-loader" }
        ],
        loaders: [
            { test: /\.json$/, loader: "json" },
            { test: /\.js$/, loader: "babel", include: path.resolve('./src') },
            {
                test: /\.scss$/,

                // 1. postcss-loader turns the SCSS into normal CSS.
                // 2. css-raw-loader turns the CSS into a javascript module
                //    whose default export is a string containing the CSS.
                //    (css-raw-loader is similar to css-loader, but the latter
                //    would also drag in the imgs and fonts that our CSS refers to
                //    as webpack inputs.)
                // 3. ExtractTextPlugin turns that string into a separate asset.
                loader: ExtractTextPlugin.extract(
                    "css-raw-loader!postcss-loader?config=postcss.config.js"
                ),
            },
            {
                // this works similarly to the scss case, without postcss.
                test: /\.css$/,
                loader: ExtractTextPlugin.extract("css-raw-loader"),
            },
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
            "bundles/[hash]/[name].css",
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
