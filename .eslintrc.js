module.exports = {
    parser: "babel-eslint",
    extends: ["./node_modules/matrix-js-sdk/.eslintrc.js"],
    plugins: [
      "react",
      "flowtype",
    ],
    env: {
        es6: true,
    },
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        }
    },
    rules: {
        /** react **/
        // This just uses the react plugin to help eslint known when
        // variables have been used in JSX
        "react/jsx-uses-vars": "error",

        // bind or arrow function in props causes performance issues
        "react/jsx-no-bind": ["error", {
            "ignoreRefs": true,
        }],
        "react/jsx-key": ["error"],

        /** flowtype **/
        "flowtype/require-parameter-type": ["warn", {
            "excludeArrowFunctions": true,
        }],
        "flowtype/define-flow-type": "warn",
        "flowtype/require-return-type": ["warn",
            "always",
            {
              "annotateUndefined": "never",
              "excludeArrowFunctions": true,
            }
        ],
        "flowtype/space-after-type-colon": ["warn", "always"],
        "flowtype/space-before-type-colon": ["warn", "never"],

        /*
         * things that are errors in the js-sdk config that the current
         * code does not adhere to, turned down to warn
         */
        "max-len": ["warn"],
        "valid-jsdoc": ["warn"],
        "new-cap": ["warn"],
        "key-spacing": ["warn"],
        "arrow-parens": ["warn"],
        "prefer-const": ["warn"],

        // crashes currently: https://github.com/eslint/eslint/issues/6274
        "generator-star-spacing": "off",
    },
    settings: {
        flowtype: {
            onlyFilesWithFlowAnnotation: true
        },
    },
};
