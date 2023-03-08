module.exports = {
    sourceMaps: true,
    assumptions: {
        setPublicClassFields: true,
    },
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
                include: [
                    "@babel/plugin-proposal-nullish-coalescing-operator",
                    "@babel/plugin-proposal-class-properties",
                ],
            },
        ],
        "@babel/preset-react",
        ["@babel/preset-typescript", { allowDeclareFields: true }],
    ],
    plugins: [
        "@babel/plugin-proposal-export-default-from",
        "@babel/plugin-proposal-numeric-separator",
        "@babel/plugin-proposal-object-rest-spread",
        "@babel/plugin-proposal-optional-chaining",

        // transform logical assignment (??=, ||=, &&=). preset-env doesn't
        // normally bother with these (presumably because all the target
        // browsers support it natively), but they make our webpack version (or
        // something downstream of babel, at least) fall over.
        "@babel/plugin-proposal-logical-assignment-operators",

        "@babel/plugin-syntax-dynamic-import",
        "@babel/plugin-transform-runtime",
    ],
};
