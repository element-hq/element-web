module.exports = {
    sourceMaps: true,
    presets: [
        [
            "@babel/preset-env",
            {
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
        "@babel/plugin-transform-runtime",
    ],
};
