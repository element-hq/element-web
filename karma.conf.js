// karma.conf.js - the config file for karma, which runs our tests.

var path = require('path');
var webpack = require('webpack');

/*
 * We use webpack to build our tests. It's a pain to have to wait for webpack
 * to build everything; however it's the easiest way to load our dependencies
 * from node_modules.
 *
 * If you run karma in multi-run mode (with `npm run test:multi`), it will watch
 * the tests for changes, and webpack will rebuild using a cache. This is much quicker
 * than a clean rebuild.
 */

// the name of the test file. By default, a special file which runs all tests.
var testFile = process.env.KARMA_TEST_FILE || 'test/all-tests.js';

process.env.PHANTOMJS_BIN = 'node_modules/.bin/phantomjs';
process.env.Q_DEBUG = 1;

module.exports = function (config) {
    config.set({
        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],

        // list of files / patterns to load in the browser
        files: [
            'node_modules/babel-polyfill/browser.js',
            testFile,

            // make the images available via our httpd. They will be avaliable
            // below http://localhost:[PORT]/base/. See also `proxies` which
            // defines alternative URLs for them.
            //
            // This isn't required by any of the tests, but it stops karma
            // logging warnings when it serves a 404 for them.
            {
                pattern: 'src/skins/vector/img/*',
                watched: false, included: false, served: true, nocache: false,
            },
        ],

        proxies: {
            // redirect img links to the karma server. See above.
            "/img/": "/base/src/skins/vector/img/",
        },

        // preprocess matching files before serving them to the browser
        // available preprocessors:
        // https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            'test/**/*.js': ['webpack', 'sourcemap']
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress', 'junit'],

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
        // singleRun: false,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,

        junitReporter: {
            outputDir: 'karma-reports',
        },

        webpack: {
            module: {
                preLoaders: [
                    // use the source-map-loader for javascript. This means
                    // that we have a better chance of seeing line numbers from
                    // the pre-babeled source.
                    { test: /\.js$/, loader: "source-map-loader" },
                ],
                loaders: [
                    { test: /\.json$/, loader: "json" },
                    {
                        test: /\.js$/, loader: "babel",
                        include: [path.resolve('./src'),
                                  path.resolve('./test'),
                                 ]
                    },
                ],
                noParse: [
                    // don't parse the languages within highlight.js. They
                    // cause stack overflows
                    // (https://github.com/webpack/webpack/issues/1721), and
                    // there is no need for webpack to parse them - they can
                    // just be included as-is.
                    /highlight\.js\/lib\/languages/,

                    // also disable parsing for sinon, because it
                    // tries to do voodoo with 'require' which upsets
                    // webpack (https://github.com/webpack/webpack/issues/304)
                    /sinon\/pkg\/sinon\.js$/,
                ],
            },
            resolve: {
                alias: {
                    // alias any requires to the react module to the one in our path, otherwise
                    // we tend to get the react source included twice when using npm link.
                    react: path.resolve('./node_modules/react'),

                    // same goes for js-sdk
                    "matrix-js-sdk": path.resolve('./node_modules/matrix-js-sdk'),

                    sinon: 'sinon/pkg/sinon.js',
                },
                root: [
                    path.resolve('./src'),
                    path.resolve('./test'),
                ],
            },
            plugins: [
                // olm may not be installed, so avoid webpack warnings by
                // ignoring it.
                new webpack.IgnorePlugin(/^olm$/),
            ],
            devtool: 'inline-source-map',
        },
    });
};
