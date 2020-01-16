module.exports = {
    "sourceMaps": "inline",
    "presets": [
        ["@babel/preset-env", {
            "targets": {
                "browsers": [
                    "last 2 versions"
                ]
            },
            "modules": "commonjs"
        }],
        "@babel/preset-typescript",
        "@babel/preset-flow",
        "@babel/preset-react"
    ],
    "plugins": [
        ["@babel/plugin-proposal-decorators", { "legacy": true }],
        "@babel/plugin-proposal-export-default-from",
        "@babel/plugin-proposal-numeric-separator",
        "@babel/plugin-proposal-class-properties",
        "@babel/plugin-proposal-object-rest-spread",
        "@babel/plugin-transform-flow-comments",
        "@babel/plugin-syntax-dynamic-import",
        "@babel/plugin-transform-runtime"
    ]
};
