var path = require('path');
var webpack = require('webpack');

module.exports = {
    module: {
        preLoaders: [
            { test: /\.js$/, loader: "source-map-loader" }
        ],
        loaders: [
            { test: /\.json$/, loader: "json" },
            { test: /\.js$/, loader: "babel", include: path.resolve('./src') },
        ]
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
        },
    },
    plugins: [
        new webpack.IgnorePlugin(/^olm/),
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV)
            }
        })
    ],
    devtool: 'source-map'
};
