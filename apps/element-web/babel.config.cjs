module.exports = {
    sourceMaps: true,
    presets: [
        [
            "@babel/preset-env",
            {
                targets: [
                    "last 2 Chrome versions",
                    "last 2 Firefox versions",
                    "last 2 Safari versions",
                    "last 2 Edge versions",
                ],
                include: ["@babel/plugin-transform-class-properties"],
            },
        ],
        ["@babel/preset-typescript", { allowDeclareFields: true }],
        "@babel/preset-react",
    ],
    plugins: [
        "@babel/plugin-proposal-export-default-from",
        "@babel/plugin-transform-numeric-separator",
        "@babel/plugin-transform-object-rest-spread",
        "@babel/plugin-transform-optional-chaining",
        "@babel/plugin-transform-nullish-coalescing-operator",

        // transform logical assignment (??=, ||=, &&=). preset-env doesn't
        // normally bother with these (presumably because all the target
        // browsers support it natively), but they make our webpack version (or
        // something downstream of babel, at least) fall over.
        "@babel/plugin-transform-logical-assignment-operators",

        "@babel/plugin-syntax-dynamic-import",
        "@babel/plugin-transform-runtime",
        ["@babel/plugin-proposal-decorators", { version: "2023-11" }], // only needed by the js-sdk
        "@babel/plugin-transform-class-static-block", // only needed by the js-sdk for decorators
    ],
};
