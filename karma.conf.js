// karma.conf.js
var webpack = require('webpack');
var path = require('path');

module.exports = function (config) {
    config.set({
        browsers: ['Chrome'],
        singleRun: true,
        frameworks: ['mocha'],
        files: [
            'tests/tests.js'
        ],
        preprocessors: {
            'tests/tests.js': ['webpack', 'sourcemap']
        },
        reporters: ['dots'],
        webpack: {
            module: {
                loaders: [
                    { test: /\.json$/, loader: "json" },
                    { test: /\.js$/, loader: "babel", include: path.resolve('./src') },
                ],
                noParse: [
                    // don't parse the languages within highlight.js. They
                    // cause stack overflows
                    // (https://github.com/webpack/webpack/issues/1721), and
                    // there is no need for webpack to parse them - they can
                    // just be included as-is.
                    /highlight\.js\/lib\/languages/,
                ],
            },
            resolve: {
                alias: {
                    'matrix-react-sdk': path.resolve('src/index.js'),
                },
            },
        },
    });
};
