/* eslint-disable quote-props */

const dotenv = require("dotenv");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackInjectPreload = require("@principalstudio/html-webpack-inject-preload");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const VersionFilePlugin = require("webpack-version-file-plugin");
const { RetryChunkLoadPlugin } = require("webpack-retry-chunk-load-plugin");

// Environment variables
// RIOT_OG_IMAGE_URL: specifies the URL to the image which should be used for the opengraph logo.
// CSP_EXTRA_SOURCE: specifies a URL which should be appended to each CSP directive which uses 'self',
//   this can be helpful if your deployment has redirects for old bundles, such as develop.element.io.

dotenv.config();
let ogImageUrl = process.env.RIOT_OG_IMAGE_URL;
if (!ogImageUrl) ogImageUrl = "https://app.element.io/themes/element/img/logos/opengraph.png";

const cssThemes = {
    // CSS themes
    "theme-legacy-light": "./res/themes/legacy-light/css/legacy-light.pcss",
    "theme-legacy-dark": "./res/themes/legacy-dark/css/legacy-dark.pcss",
    "theme-light": "./res/themes/light/css/light.pcss",
    "theme-light-high-contrast": "./res/themes/light-high-contrast/css/light-high-contrast.pcss",
    "theme-dark": "./res/themes/dark/css/dark.pcss",
    "theme-light-custom": "./res/themes/light-custom/css/light-custom.pcss",
    "theme-dark-custom": "./res/themes/dark-custom/css/dark-custom.pcss",
};

// See docs/customisations.md
let fileOverrides = {
    /* {[file: string]: string} */
};
try {
    fileOverrides = require("./customisations.json");

    // stringify the output so it appears in logs correctly, as large files can sometimes get
    // represented as `<Object>` which is less than helpful.
    console.log("Using customisations.json : " + JSON.stringify(fileOverrides, null, 4));

    process.on("exit", () => {
        console.log(""); // blank line
        console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.warn("!! Customisations have been deprecated and will be removed in a future release      !!");
        console.warn("!! See https://github.com/element-hq/element-web/blob/develop/docs/customisations.md !!");
        console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log(""); // blank line
    });
} catch (e) {
    // ignore - not important
}

function parseOverridesToReplacements(overrides) {
    return Object.entries(overrides).map(([oldPath, newPath]) => {
        return new webpack.NormalModuleReplacementPlugin(
            // because the input is effectively defined by the person running the build, we don't
            // need to do anything special to protect against regex overrunning, etc.
            new RegExp(oldPath.replace(/\//g, "[\\/\\\\]").replace(/\./g, "\\.")),
            function (resource) {
                resource.request = path.resolve(__dirname, newPath);
                resource.createData.resource = path.resolve(__dirname, newPath);
                // Starting with Webpack 5 we also need to set the context as otherwise replacing
                // files in e.g. matrix-js-sdk with files from element-web will try to resolve
                // them within matrix-js-sdk (https://github.com/webpack/webpack/issues/17716)
                resource.context = path.dirname(resource.request);
                resource.createData.context = path.dirname(resource.createData.resource);
            },
        );
    });
}

const moduleReplacementPlugins = [
    ...parseOverridesToReplacements(require("./components.json")),

    // Allow customisations to override the default components too
    ...parseOverridesToReplacements(fileOverrides),
];

module.exports = (env, argv) => {
    // Establish settings based on the environment and args.
    //
    // argv.mode is always set to "production" by yarn build
    //      (called to build prod, nightly and develop.element.io)
    // arg.mode is set to "development" by yarn start
    //      (called by developers, runs the continuous reload script)
    // process.env.CI_PACKAGE is set when yarn build is called from scripts/ci_package.sh
    //      (called to build nightly and develop.element.io)
    const nodeEnv = argv.mode;
    const devMode = nodeEnv !== "production";
    const enableMinification = !devMode && !process.env.CI_PACKAGE;

    let VERSION = process.env.VERSION;
    if (!VERSION) {
        VERSION = require("./package.json").version;
        if (devMode) {
            VERSION += "-dev";
        }
    }

    const development = {};
    if (devMode) {
        // Embedded source maps for dev builds, can't use eval-source-map due to CSP
        development["devtool"] = "inline-source-map";
    } else {
        // High quality source maps in separate .map files which include the source. This doesn't bulk up the .js
        // payload file size, which is nice for performance but also necessary to get the bundle to a small enough
        // size that sentry will accept the upload.
        development["devtool"] = "source-map";
    }

    // Resolve the directories for the js-sdk for later use. We resolve these early, so we
    // don't have to call them over and over. We also resolve to the package.json instead of the src
    // directory, so we don't have to rely on an index.js or similar file existing.
    const jsSdkSrcDir = path.resolve(require.resolve("matrix-js-sdk/package.json"), "..", "src");

    return {
        ...development,

        experiments: {
            asyncWebAssembly: true,
        },

        bail: true,

        entry: {
            bundle: "./src/vector/index.ts",
            mobileguide: "./src/vector/mobile_guide/index.ts",
            jitsi: "./src/vector/jitsi/index.ts",
            usercontent: "./src/usercontent/index.ts",
            serviceworker: {
                import: "./src/serviceworker/index.ts",
                filename: "sw.js", // update WebPlatform if this changes
            },
            ...cssThemes,
        },

        optimization: {
            // Put all of our CSS into one useful place - this is needed for MiniCssExtractPlugin.
            // Previously we used a different extraction plugin that did this magic for us, but
            // now we need to consider that the CSS needs to be bundled up together.
            splitChunks: {
                cacheGroups: {
                    styles: {
                        name: "styles",
                        test: /\.css$/,
                        enforce: true,
                        // Do not add `chunks: 'all'` here because you'll break the app entry point.
                    },

                    // put the unhomoglyph data in its own file. It contains
                    // magic characters which mess up line numbers in the
                    // javascript debugger.
                    unhomoglyph_data: {
                        name: "unhomoglyph_data",
                        test: /unhomoglyph\/data\.json$/,
                        enforce: true,
                        chunks: "all",
                    },

                    default: {
                        reuseExistingChunk: true,
                    },
                },
            },

            // Readable IDs for better debugging
            moduleIds: "named",

            // Minification is normally enabled by default for webpack in production mode, but
            // we use a CSS optimizer too and need to manage it ourselves.
            minimize: enableMinification,
            minimizer: enableMinification
                ? [
                      new TerserPlugin({
                          // Already minified and includes an auto-generated license comment
                          // that the plugin would otherwise pointlessly extract into a separate
                          // file. We add the actual license using CopyWebpackPlugin below.
                          exclude: "jitsi_external_api.min.js",
                      }),
                      new CssMinimizerPlugin(),
                  ]
                : [],

            // Set the value of `process.env.NODE_ENV` for libraries like React
            // See also https://v4.webpack.js.org/configuration/optimization/#optimizationnodeenv
            nodeEnv,
        },

        resolve: {
            // We need to specify that TS can be resolved without an extension
            extensions: [".js", ".json", ".ts", ".tsx"],
            alias: {
                // alias any requires to the react module to the one in our path,
                // otherwise we tend to get the react source included twice when
                // using `npm link` / `yarn link`.
                "react": path.resolve(__dirname, "node_modules/react"),
                "react-dom": path.resolve(__dirname, "node_modules/react-dom"),

                // Same goes for js/react-sdk - we don't need two copies.
                "matrix-js-sdk": path.resolve(__dirname, "node_modules/matrix-js-sdk"),
                "@matrix-org/react-sdk-module-api": path.resolve(
                    __dirname,
                    "node_modules/@matrix-org/react-sdk-module-api",
                ),
                // and matrix-events-sdk & matrix-widget-api
                "matrix-events-sdk": path.resolve(__dirname, "node_modules/matrix-events-sdk"),
                "matrix-widget-api": path.resolve(__dirname, "node_modules/matrix-widget-api"),
                "oidc-client-ts": path.resolve(__dirname, "node_modules/oidc-client-ts"),

                // Define a variable so the i18n stuff can load
                "$webapp": path.resolve(__dirname, "webapp"),
            },
            fallback: {
                // Mock out the NodeFS module: The opus decoder imports this wrongly.
                "fs": false,
                "net": false,
                "tls": false,
                "crypto": false,

                // Polyfill needed by counterpart
                "util": require.resolve("util/"),
                // Polyfill needed by sentry
                "process/browser": require.resolve("process/browser"),
            },

            // Enable the custom "wasm-esm" export condition [1] to indicate to
            // matrix-sdk-crypto-wasm that we support the ES Module Integration
            // Proposal for WebAssembly [2].  The "..." magic value means "the
            // default conditions" [3].
            //
            // [1]: https://nodejs.org/api/packages.html#conditional-exports
            // [2]: https://github.com/webassembly/esm-integration
            // [3]: https://github.com/webpack/webpack/issues/17692#issuecomment-1866272674.
            conditionNames: ["matrix-org:wasm-esm", "..."],
        },

        // Some of our deps have broken source maps, so we have to ignore warnings or exclude them one-by-one
        ignoreWarnings: [/Failed to parse source map/],

        module: {
            noParse: [
                // for cross platform compatibility use [\\\/] as the path separator
                // this ensures that the regex trips on both Windows and *nix

                // don't parse the languages within highlight.js. They cause stack
                // overflows (https://github.com/webpack/webpack/issues/1721), and
                // there is no need for webpack to parse them - they can just be
                // included as-is.
                /highlight\.js[\\/]lib[\\/]languages/,
            ],
            rules: [
                {
                    test: /\.js$/,
                    enforce: "pre",
                    use: ["source-map-loader"],
                },
                {
                    test: /\.(ts|js)x?$/,
                    include: (f) => {
                        // our own source needs babel-ing
                        if (f.startsWith(path.resolve(__dirname, "src"))) return true;

                        // we use the original source files of js-sdk, so we need to
                        // run them through babel. Because the path tested is the resolved, absolute
                        // path, these could be anywhere thanks to yarn link. We must also not
                        // include node modules inside these modules, so we add 'src'.
                        if (f.startsWith(jsSdkSrcDir)) return true;

                        // Some of the syntax in this package is not understood by
                        // either webpack or our babel setup.
                        // When we do get to upgrade our current setup, this should
                        // probably be removed.
                        if (f.includes(path.join("@vector-im", "compound-web"))) return true;

                        // but we can't run all of our dependencies through babel (many of them still
                        // use module.exports which breaks if babel injects an 'include' for its
                        // polyfills: probably fixable but babeling all our dependencies is probably
                        // not necessary anyway). So, for anything else, don't babel.
                        return false;
                    },
                    loader: "babel-loader",
                    options: {
                        cacheDirectory: true,
                        plugins: enableMinification ? ["babel-plugin-jsx-remove-data-test-id"] : [],
                    },
                },
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader",
                            options: {
                                importLoaders: 1,
                                sourceMap: true,
                                esModule: false,
                            },
                        },
                        {
                            loader: "postcss-loader",
                            ident: "postcss",
                            options: {
                                sourceMap: true,
                                postcssOptions: () => ({
                                    "plugins": [
                                        // Note that we use significantly fewer plugins on the plain
                                        // CSS parser. If we start to parse plain CSS, we end with all
                                        // kinds of nasty problems (like stylesheets not loading).
                                        //
                                        // You might have noticed that we're also sending regular CSS
                                        // through PostCSS. This looks weird, and in fact is probably
                                        // not what you'd expect, however in order for our CSS build
                                        // to work nicely we have to do this. Because down the line
                                        // our SCSS stylesheets reference plain CSS we have to load
                                        // the plain CSS through PostCSS so it can find it safely. This
                                        // also acts like a babel-for-css by transpiling our (S)CSS
                                        // down/up to the right browser support (prefixes, etc).
                                        // Further, if we don't do this then PostCSS assumes that our
                                        // plain CSS is SCSS and it really doesn't like that, even
                                        // though plain CSS should be compatible. The chunking options
                                        // at the top of this webpack config help group the SCSS and
                                        // plain CSS together for the bundler.

                                        require("postcss-simple-vars")(),
                                        require("postcss-hexrgba")(),

                                        // It's important that this plugin is last otherwise we end
                                        // up with broken CSS.
                                        require("postcss-preset-env")({ stage: 3, browsers: "last 2 versions" }),
                                    ],
                                    "parser": "postcss-scss",
                                    "local-plugins": true,
                                }),
                            },
                        },
                    ],
                },
                {
                    test: /\.pcss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader",
                            options: {
                                importLoaders: 1,
                                sourceMap: true,
                                esModule: false,
                            },
                        },
                        {
                            loader: "postcss-loader",
                            ident: "postcss",
                            options: {
                                sourceMap: true,
                                postcssOptions: () => ({
                                    "plugins": [
                                        // Note that we use slightly different plugins for PostCSS.
                                        require("postcss-import")(),
                                        require("postcss-mixins")(),
                                        require("postcss-simple-vars")(),
                                        require("postcss-nested")(),
                                        require("postcss-easings")(),
                                        require("postcss-hexrgba")(),

                                        // It's important that this plugin is last otherwise we end
                                        // up with broken CSS.
                                        require("postcss-preset-env")({ stage: 3, browsers: "last 2 versions" }),
                                    ],
                                    "parser": "postcss-scss",
                                    "local-plugins": true,
                                }),
                            },
                        },
                    ],
                },
                {
                    // Fix up the name of the opus-recorder worker (react-sdk dependency).
                    // We more or less just want it to be clear it's for opus and not something else.
                    test: /encoderWorker\.min\.js$/,
                    loader: "file-loader",
                    type: "javascript/auto",
                    options: {
                        // We deliberately override the name so it makes sense in debugging
                        name: "opus-encoderWorker.min.[hash:7].[ext]",
                        outputPath: ".",
                    },
                },
                {
                    // Ideally we should use the built-in worklet support in Webpack 5 with the syntax
                    // described in https://github.com/webpack/webpack.js.org/issues/6869. However, this
                    // doesn't currently appear to work with our public path setup. So we handle this
                    // with a custom loader instead.
                    test: /RecorderWorklet\.ts$/,
                    type: "javascript/auto",
                    use: [
                        {
                            loader: path.resolve("./recorder-worklet-loader.js"),
                        },
                        {
                            loader: "babel-loader",
                        },
                    ],
                },
                {
                    // This is from the same place as the encoderWorker above, but only needed
                    // for Safari support.
                    test: /decoderWorker\.min\.js$/,
                    loader: "file-loader",
                    type: "javascript/auto", // https://github.com/webpack/webpack/issues/6725
                    options: {
                        // We deliberately override the name so it makes sense in debugging
                        name: "opus-decoderWorker.min.[hash:7].[ext]",
                        outputPath: ".",
                    },
                },
                {
                    // The decoderWorker wants to load its own wasm, rather than have webpack do it.
                    // We therefore use the `file-loader` to tell webpack to dump the contents to
                    // a separate file and return the name, and override the default `type` for `.wasm` files
                    // (which is `webassembly/experimental` under webpack 4) to stop webpack trying to interpret
                    // the filename as webassembly. (see also https://github.com/webpack/webpack/issues/6725)
                    test: /decoderWorker\.min\.wasm$/,
                    loader: "file-loader",
                    type: "javascript/auto",
                    options: {
                        // We deliberately don't change the name because the decoderWorker has this
                        // hardcoded. This is here to avoid the default wasm rule from adding a hash.
                        name: "decoderWorker.min.wasm",
                        outputPath: ".",
                    },
                },
                {
                    // This is from the same place as the encoderWorker above, but only needed
                    // for Safari support.
                    test: /waveWorker\.min\.js$/,
                    loader: "file-loader",
                    type: "javascript/auto", // https://github.com/webpack/webpack/issues/6725
                    options: {
                        // We deliberately override the name so it makes sense in debugging
                        name: "wave-encoderWorker.min.[hash:7].[ext]",
                        outputPath: ".",
                    },
                },
                {
                    // cache-bust languages.json file placed in
                    // element-web/webapp/i18n during build by copy-res.ts
                    test: /\.*languages.json$/,
                    type: "javascript/auto",
                    loader: "file-loader",
                    options: {
                        name: "i18n/[name].[hash:7].[ext]",
                    },
                },
                {
                    test: /\.svg$/,
                    issuer: /\.(js|ts|jsx|tsx|html)$/,
                    use: [
                        {
                            loader: "@svgr/webpack",
                            options: {
                                namedExport: "Icon",
                                svgProps: {
                                    "role": "presentation",
                                    "aria-hidden": true,
                                },
                                // props set on the svg will override defaults
                                expandProps: "end",
                                svgoConfig: {
                                    plugins: [
                                        {
                                            name: "preset-default",
                                            params: {
                                                overrides: {
                                                    removeViewBox: false,
                                                },
                                            },
                                        },
                                        // generates a viewbox if missing
                                        { name: "removeDimensions" },
                                        // https://github.com/facebook/docusaurus/issues/8297
                                        { name: "prefixIds" },
                                    ],
                                },
                                /**
                                 * Forwards the React ref to the root SVG element
                                 * Useful when using things like `asChild` in
                                 * radix-ui
                                 */
                                ref: true,
                                esModule: false,
                                name: "[name].[hash:7].[ext]",
                                outputPath: getAssetOutputPath,
                                publicPath: function (url, resourcePath) {
                                    const outputPath = getAssetOutputPath(url, resourcePath);
                                    return toPublicPath(outputPath);
                                },
                            },
                        },
                        {
                            loader: "file-loader",
                            options: {
                                esModule: false,
                                name: "[name].[hash:7].[ext]",
                                outputPath: getAssetOutputPath,
                                publicPath: function (url, resourcePath) {
                                    const outputPath = getAssetOutputPath(url, resourcePath);
                                    return toPublicPath(outputPath);
                                },
                            },
                        },
                    ],
                },
                {
                    test: /\.svg$/,
                    issuer: /\.(pcss|scss|css)$/,
                    use: [
                        {
                            loader: "file-loader",
                            options: {
                                esModule: false,
                                name: "[name].[hash:7].[ext]",
                                outputPath: getAssetOutputPath,
                                publicPath: function (url, resourcePath) {
                                    // CSS image usages end up in the `bundles/[hash]` output
                                    // directory, so we adjust the final path to navigate up
                                    // twice.
                                    const outputPath = getAssetOutputPath(url, resourcePath);
                                    return toPublicPath(path.join("../..", outputPath));
                                },
                            },
                        },
                    ],
                },
                {
                    test: /\.(gif|png|ttf|woff|woff2|xml|ico)$/,
                    // Use a content-based hash in the name so that we can set a long cache
                    // lifetime for assets while still delivering changes quickly.
                    oneOf: [
                        {
                            // Assets referenced in CSS files
                            issuer: /\.(pcss|scss|css)$/,
                            loader: "file-loader",
                            options: {
                                esModule: false,
                                name: "[name].[hash:7].[ext]",
                                outputPath: getAssetOutputPath,
                                publicPath: function (url, resourcePath) {
                                    // CSS image usages end up in the `bundles/[hash]` output
                                    // directory, so we adjust the final path to navigate up
                                    // twice.
                                    const outputPath = getAssetOutputPath(url, resourcePath);
                                    return toPublicPath(path.join("../..", outputPath));
                                },
                            },
                        },
                        {
                            // Assets referenced in HTML and JS files
                            loader: "file-loader",
                            options: {
                                esModule: false,
                                name: "[name].[hash:7].[ext]",
                                outputPath: getAssetOutputPath,
                                publicPath: function (url, resourcePath) {
                                    const outputPath = getAssetOutputPath(url, resourcePath);
                                    return toPublicPath(outputPath);
                                },
                            },
                        },
                    ],
                },
            ].filter(Boolean),
        },

        plugins: [
            ...moduleReplacementPlugins,

            // This exports our CSS using the splitChunks and loaders above.
            new MiniCssExtractPlugin({
                filename: "bundles/[fullhash]/[name].css",
                chunkFilename: "bundles/[fullhash]/[name].css",
                ignoreOrder: false, // Enable to remove warnings about conflicting order
            }),

            // This is the app's main entry point.
            new HtmlWebpackPlugin({
                template: "./src/vector/index.html",

                // we inject the links ourselves via the template, because
                // HtmlWebpackPlugin will screw up our formatting like the names
                // of the themes and which chunks we actually care about.
                inject: false,
                excludeChunks: ["mobileguide", "usercontent", "jitsi", "serviceworker"],
                minify: false,
                templateParameters: {
                    og_image_url: ogImageUrl,
                    csp_extra_source: process.env.CSP_EXTRA_SOURCE ?? "",
                },
            }),

            // This is the jitsi widget wrapper (embedded, so isolated stack)
            new HtmlWebpackPlugin({
                template: "./src/vector/jitsi/index.html",
                filename: "jitsi.html",
                minify: false,
                chunks: ["jitsi"],
            }),

            // This is the mobile guide's entry point (separate for faster mobile loading)
            new HtmlWebpackPlugin({
                template: "./src/vector/mobile_guide/index.html",
                filename: "mobile_guide/index.html",
                minify: false,
                chunks: ["mobileguide"],
            }),

            // These are the static error pages for when the javascript env is *really unsupported*
            new HtmlWebpackPlugin({
                template: "./src/vector/static/unable-to-load.html",
                filename: "static/unable-to-load.html",
                minify: false,
                chunks: [],
            }),
            new HtmlWebpackPlugin({
                template: "./src/vector/static/incompatible-browser.html",
                filename: "static/incompatible-browser.html",
                minify: false,
                chunks: [],
            }),

            // This is the usercontent sandbox's entry point (separate for iframing)
            new HtmlWebpackPlugin({
                template: "./src/usercontent/index.html",
                filename: "usercontent/index.html",
                minify: false,
                chunks: ["usercontent"],
            }),

            new HtmlWebpackInjectPreload({
                files: [{ match: /.*Inter.*\.woff2$/ }],
            }),

            // Upload to sentry if sentry env is present
            // This plugin throws an error on import on some platforms like ppc64le & s390x even if the plugin isn't called,
            // so we require it conditionally.
            process.env.SENTRY_DSN &&
                require("@sentry/webpack-plugin").sentryWebpackPlugin({
                    release: process.env.VERSION,
                    sourcemaps: {
                        paths: "./webapp/bundles/**",
                    },
                    errorHandler: (err) => {
                        console.warn("Sentry CLI Plugin: " + err.message);
                        console.log(`::warning title=Sentry error::${err.message}`);
                    },
                }),

            new CopyWebpackPlugin({
                patterns: [
                    "res/apple-app-site-association",
                    { from: ".well-known/**", context: path.resolve(__dirname, "res") },
                    "res/jitsi_external_api.min.js",
                    "res/jitsi_external_api.min.js.LICENSE.txt",
                    "res/manifest.json",
                    "res/welcome.html",
                    { from: "welcome/**", context: path.resolve(__dirname, "res") },
                    { from: "themes/**", context: path.resolve(__dirname, "res") },
                    { from: "vector-icons/**", context: path.resolve(__dirname, "res") },
                    { from: "decoder-ring/**", context: path.resolve(__dirname, "res") },
                    { from: "media/**", context: path.resolve(__dirname, "res/") },
                    { from: "config.json", noErrorOnMissing: true },
                    "contribute.json",
                    // Element Call embedded widget
                    {
                        from: "**",
                        context: path.resolve(__dirname, "node_modules/@element-hq/element-call-embedded/dist"),
                        to: path.join(__dirname, "webapp", "widgets", "element-call"),
                    },
                ],
            }),

            // Automatically load buffer & process modules as we use them without explicitly
            // importing them
            new webpack.ProvidePlugin({
                process: "process/browser",
            }),

            // We bake the version in so the app knows its version immediately
            new webpack.DefinePlugin({ "process.env.VERSION": JSON.stringify(VERSION) }),
            // But we also write it to a file which gets polled for update detection
            new VersionFilePlugin({
                outputFile: "version",
                templateString: "<%= extras.VERSION %>",
                extras: { VERSION },
            }),

            // Due to issues such as https://github.com/vector-im/element-web/issues/25277 we should retry chunk loading
            new RetryChunkLoadPlugin({
                cacheBust: `() => Date.now()`,
                retryDelay: 500,
                maxRetries: 3,
            }),
        ].filter(Boolean),

        output: {
            path: path.join(__dirname, "webapp"),

            // There are a lot of assets that need to be kept in sync with each other
            // (once a user loads one version of the app, they need to keep being served
            // assets for that version).
            //
            // To deal with this, we try to put as many as possible of the referenced assets
            // into a build-specific subdirectory. This includes generated javascript, as well
            // as CSS extracted by the MiniCssExtractPlugin (see config above) and WASM modules
            // referenced via `import` statements.
            //
            // Hosting servers can then collect 'bundles' from multiple versions
            // into one directory, and continue to serve them even after a new version is deployed.
            // This allows users who loaded an older version of the application to continue to
            // access assets even after the app is redeployed.
            //
            // See `scripts/deploy.py` for a script which manages the deployment in this way.
            filename: "bundles/[fullhash]/[name].js",
            chunkFilename: "bundles/[fullhash]/[name].js",
            webassemblyModuleFilename: "bundles/[fullhash]/[modulehash].wasm",
        },

        // configuration for the webpack-dev-server
        devServer: {
            client: {
                overlay: {
                    // Only show overlay on build errors as anything more can get annoying quickly
                    errors: true,
                    warnings: false,
                    runtimeErrors: false,
                },
            },

            static: {
                // Where to serve static assets from
                directory: "./webapp",
            },

            devMiddleware: {
                // Only output errors, warnings, or new compilations.
                // This hides the massive list of modules.
                stats: "minimal",
            },

            // Enable Hot Module Replacement without page refresh as a fallback in
            // case of build failures
            hot: "only",

            // Disable host check
            allowedHosts: "all",
        },
    };
};

/**
 * Merge assets found via CSS and imports into a single tree, while also preserving
 * directories under e.g. `res` or similar.
 *
 * @param {string} url The adjusted name of the file, such as `warning.1234567.svg`.
 * @param {string} resourcePath The absolute path to the source file with unmodified name.
 * @return {string} The returned paths will look like `img/warning.1234567.svg`.
 */
function getAssetOutputPath(url, resourcePath) {
    const isKaTeX = resourcePath.includes("KaTeX");
    const isFontSource = resourcePath.includes("@fontsource");
    // `res` is the parent dir for our own assets in various layers
    // `dist` is the parent dir for KaTeX assets
    // `files` is the parent dir for @fontsource assets
    const prefix = /^.*[/\\](dist|res|files)[/\\]/;

    /**
     * Only needed for https://github.com/element-hq/element-web/pull/15939
     * If keeping this, we are not able to load external assets such as SVG
     * images coming from @vector-im/compound-web.
     */
    if (isKaTeX && !resourcePath.match(prefix)) {
        throw new Error(`Unexpected asset path: ${resourcePath}`);
    }
    let outputDir = path.dirname(resourcePath).replace(prefix, "");

    /**
     * Imports from Compound are "absolute", we need to strip out the prefix
     * coming before the npm package name.
     *
     * This logic is scoped to compound packages for now as they are the only
     * package that imports external assets. This might need to be made more
     * generic in the future
     */
    const compoundImportsPrefix = /@vector-im(?:\\|\/)compound-(.*?)(?:\\|\/)/;
    const compoundMatch = outputDir.match(compoundImportsPrefix);
    if (compoundMatch) {
        outputDir = outputDir.substring(compoundMatch.index + compoundMatch[0].length);
    }

    if (isFontSource) {
        outputDir = "fonts";
    }

    if (isKaTeX) {
        // Add a clearly named directory segment, rather than leaving the KaTeX
        // assets loose in each asset type directory.
        outputDir = path.join(outputDir, "KaTeX");
    }
    return path.join(outputDir, path.basename(url));
}

/**
 * Convert path to public path format, which always uses forward slashes, since it will
 * be placed directly into things like CSS files.
 *
 * @param {string} path Some path to a file.
 * @returns {string} converted path
 */
function toPublicPath(path) {
    return path.replace(/\\/g, "/");
}
