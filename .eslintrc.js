const path = require('path');

// get the path of the js-sdk so we can extend the config
// eslint supports loading extended configs by module,
// but only if they come from a module that starts with eslint-config-
// So we load the filename directly (and it could be in node_modules/
// or or ../node_modules/ etc)
const matrixJsSdkPath = path.dirname(require.resolve('matrix-js-sdk'));

module.exports = {
    parser: "babel-eslint",
    extends: [matrixJsSdkPath + "/.eslintrc.js"],
    plugins: [
      "react",
      "flowtype",
      "babel"
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
        // eslint's built in no-invalid-this rule breaks with class properties
        "no-invalid-this": "off",
        // so we replace it with a version that is class property aware
        "babel/no-invalid-this": "error",

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
        "max-len": ["warn", {
            // apparently people believe the length limit shouldn't apply
            // to JSX.
            ignorePattern: '^\\s*<',
            ignoreComments: true,
            code: 90,
        }],
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
