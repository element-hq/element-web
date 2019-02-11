// karma.conf.js - the config file for karma, which runs our tests.

var path = require('path');
var webpack = require('webpack');
var webpack_config = require('./webpack.config');

/*
 * We use webpack to build our tests. It's a pain to have to wait for webpack
 * to build everything; however it's the easiest way to load our dependencies
 * from node_modules.
 *
 * If you run karma in multi-run mode (with `npm run test-multi`), it will watch
 * the tests for changes, and webpack will rebuild using a cache. This is much quicker
 * than a clean rebuild.
 */

// the name of the test file. By default, a special file which runs all tests.
var testFile = process.env.KARMA_TEST_FILE || 'test/all-tests.js';

process.env.PHANTOMJS_BIN = 'node_modules/.bin/phantomjs';
process.env.Q_DEBUG = 1;

/* the webpack config is based on the real one, to (a) try to simulate the
 * deployed environment as closely as possible, and (b) to avoid a shedload of
 * cut-and-paste.
 */

// find out if we're shipping olm, and where it is, if so.
const olm_entry = webpack_config.entry['olm'];

// remove the default entries - karma provides its own (via the 'files' and
// 'preprocessors' config below)
delete webpack_config['entry'];

// make sure we're flagged as development to avoid wasting time optimising
webpack_config.mode = 'development';

// add ./test as a search path for js
webpack_config.module.rules.unshift({
    test: /\.js$/, use: "babel-loader",
    include: [path.resolve('./src'), path.resolve('./test')],
});

// disable parsing for sinon, because it
// tries to do voodoo with 'require' which upsets
// webpack (https://github.com/webpack/webpack/issues/304)
webpack_config.module.noParse.push(/sinon\/pkg\/sinon\.js$/);

// ?
webpack_config.resolve.alias['sinon'] = 'sinon/pkg/sinon.js';

webpack_config.resolve.modules = [
    path.resolve('./test'),
    "node_modules"
];

webpack_config.devtool = 'inline-source-map';

module.exports = function (config) {
    const myconfig = {
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
                pattern: 'node_modules/matrix-react-sdk/res/img/*',
                watched: false, included: false, served: true, nocache: false,
            },
            {
                pattern: 'res/**',
                watched: false, included: false, served: true, nocache: false,
            },
        ],

        proxies: {
            // redirect img links to the karma server. See above.
            "/img/": "/base/node_modules/matrix-react-sdk/res/img/",
            "/themes/": "/base/res/themes/",
            "/welcome.html": "/base/res/welcome.html",
            "/welcome/": "/base/res/welcome/",
        },

        // preprocess matching files before serving them to the browser
        // available preprocessors:
        // https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            '{src,test}/**/*.js': ['webpack', 'sourcemap'],
        },

        // test results reporter to use
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['logcapture', 'spec', 'junit', 'summary'],

        specReporter: {
            suppressErrorSummary: false, // do print error summary
            suppressFailed: false, // do print information about failed tests
            suppressPassed: false, // do print information about passed tests
            showSpecTiming: true, // print the time elapsed for each spec
        },

        client: {
            captureLogs: true,
        },

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
            //'ChromeHeadless'
        ],

        customLaunchers: {
            'ChromeHeadless': {
                base: 'Chrome',
                flags: [
                    // '--no-sandbox',
                    // See https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md
                    '--headless',
                    '--disable-gpu',
                    // Without a remote debugging port, Google Chrome exits immediately.
                    '--remote-debugging-port=9222',
                ],
            }
        },

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        // singleRun: false,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,

        junitReporter: {
            outputDir: 'karma-reports',
        },

        webpack: webpack_config,

        webpackMiddleware: {
            stats: {
                // don't fill the console up with a mahoosive list of modules
                chunks: false,
            },
        },
    };

    // include the olm loader if we have it.
    if (olm_entry) {
        myconfig.files.unshift(olm_entry);
    }

    config.set(myconfig);
};
