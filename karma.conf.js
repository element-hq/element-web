// karma.conf.js - the config file for karma, which runs our tests.

var path = require('path');
var fs = require('fs');

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
//
// TODO: this could be a pattern, and karma would run each file, with a
// separate webpack bundle for each file. But then we get a separate instance
// of the sdk, and each of the dependencies, for each test file, and everything
// gets very confused. Can we persuade webpack to put all of the dependencies
// in a 'common' bundle?
//
var testFile = process.env.KARMA_TEST_FILE || 'test/all-tests.js';

process.env.PHANTOMJS_BIN = 'node_modules/.bin/phantomjs';

function fileExists(name) {
    try {
        fs.statSync(gsCss);
        return true;
    } catch (e) {
        return false;
    }
}

// try find the gemini-scrollbar css in an npm-version-agnostic way
var gsCss = 'node_modules/gemini-scrollbar/gemini-scrollbar.css';
if (!fileExists(gsCss)) {
    gsCss = 'node_modules/react-gemini-scrollbar/'+gsCss;
}


module.exports = function (config) {
    config.set({
        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'],

        // list of files / patterns to load in the browser
        files: [
            testFile,
            gsCss,
        ],

        // list of files to exclude
        //
        // This doesn't work. It turns out that it's webpack which does the
        // watching of the /test directory (karma only watches `testFile`
        // itself). Webpack watches the directory so that it can spot
        // new tests, which is fair enough; unfortunately it triggers a rebuild
        // every time a lockfile is created in that directory, and there
        // doesn't seem to be any way to tell webpack to ignore particular
        // files in a watched directory.
        //
        // exclude: [
        //     '**/.#*'
        // ],

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
        singleRun: true,

        // Concurrency level
        // how many browser should be started simultaneous
        concurrency: Infinity,

        junitReporter: {
            outputDir: 'karma-reports',
        },

        webpack: {
            module: {
                loaders: [
                    { test: /\.json$/, loader: "json" },
                    {
                        test: /\.js$/, loader: "babel",
                        include: [path.resolve('./src'),
                                  path.resolve('./test'),
                                 ],
                        query: {
                            // we're using react 5, for consistency with
                            // the release build, which doesn't use the
                            // presets.
                            // presets: ['react', 'es2015'],
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

                    // also disable parsing for sinon, because it
                    // tries to do voodoo with 'require' which upsets
                    // webpack (https://github.com/webpack/webpack/issues/304)
                    /sinon\/pkg\/sinon\.js$/,
                ],
            },
            resolve: {
                alias: {
                    'matrix-react-sdk': path.resolve('test/skinned-sdk.js'),
                    'sinon': 'sinon/pkg/sinon.js',
                },
                root: [
                    path.resolve('./src'),
                    path.resolve('./test'),
                ],
            },
            devtool: 'inline-source-map',
        },
    });
};
