// karma.conf.js
var webpack = require('webpack');
var path = require('path');

/*
 * It's a pain to have to wait for webpack to build everything; however it's
 * the easiest way to load our dependencies from node_modules.
 *
 * TODO:
 * - can we run one test at a time
 * - can we can we run under phantomjs/jsdom?
 * - write junit out
 */
module.exports = function (config) {
    config.set({
        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],

        // list of files / patterns to load in the browser
        files: [
            'test/tests.js',
        ],

        // list of files to exclude
        // (this doesn't work, and I don't know why - we still rerun the tests
        // when lockfiles are created)
        exclude: [
            '**/.#*'
        ],

        // preprocess matching files before serving them to the browser
        // available preprocessors:
        // https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'test/tests.js': ['webpack', 'sourcemap']
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress'],

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        // possible values: config.LOG_DISABLE || config.LOG_ERROR ||
        // config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
        logLevel: config.LOG_INFO,

        // enable / disable watching file and executing tests whenever any file
        // changes
        autoWatch: true,

        // start these browsers
        // available browser launchers:
        // https://npmjs.org/browse/keyword/karma-launcher
        browsers: [
            'Chrome',
            //'PhantomJS',
        ],

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,

        webpack: {
            module: {
                loaders: [
                    { test: /\.json$/, loader: "json" },
                    {
                        // disable 'require' and 'define' for sinon, per
                        // https://github.com/webpack/webpack/issues/304#issuecomment-170883329
                        test: /sinon\/pkg\/sinon\.js/,
                        // TODO: use 'query'?
                        loader: 'imports?define=>false,require=>false',
                    },
                    {
                        test: /\.js$/, loader: "babel",
                        include: [path.resolve('./src'),
                                  path.resolve('./test'),
                                 ],
                        query: {
                            presets: ['react', 'es2015']
                        },
                    },
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
                    'sinon': 'sinon/pkg/sinon.js',
                },
            },
            devtool: 'inline-source-map',
        },
    });
};
