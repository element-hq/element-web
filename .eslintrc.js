const path = require('path');

// get the path of the js-sdk so we can extend the config
// eslint supports loading extended configs by module,
// but only if they come from a module that starts with eslint-config-
// So we load the filename directly (and it could be in node_modules/
// or or ../node_modules/ etc)
//
// We add a `..` to the end because the js-sdk lives out of lib/, but the eslint
// config is at the project root.
const matrixJsSdkPath = path.join(path.dirname(require.resolve('matrix-js-sdk')), '..');

module.exports = {
    parser: "babel-eslint",
    extends: [matrixJsSdkPath + "/.eslintrc.js"],
    plugins: [
      "react",
      "react-hooks",
      "flowtype",
      "babel"
    ],
    globals: {
        LANGUAGES_FILE: "readonly",
    },
    env: {
        es6: true,
    },
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
            legacyDecorators: true,
        }
    },
    rules: {
        // eslint's built in no-invalid-this rule breaks with class properties
        "no-invalid-this": "off",
        // so we replace it with a version that is class property aware
        "babel/no-invalid-this": "error",

        // We appear to follow this most of the time, so let's enforce it instead
        // of occasionally following it (or catching it in review)
        "keyword-spacing": "error",

        /** react **/
        // This just uses the react plugin to help eslint known when
        // variables have been used in JSX
        "react/jsx-uses-vars": "error",
        // Don't mark React as unused if we're using JSX
        "react/jsx-uses-react": "error",

        // bind or arrow function in props causes performance issues
        // (but we currently use them in some places)
        // It's disabled here, but we should using it sparingly.
        "react/jsx-no-bind": "off",
        "react/jsx-key": ["error"],

        // Components in JSX should always be defined.
        "react/jsx-no-undef": "error",

        // Assert no spacing in JSX curly brackets
        // <Element prop={ consideredError} prop={notConsideredError} />
        //
        // https://github.com/yannickcr/eslint-plugin-react/blob/HEAD/docs/rules/jsx-curly-spacing.md
        //
        // Disabled for now - if anything we'd like to *enforce* spacing in JSX
        // curly brackets for legibility, but in practice it's not clear that the
        // consistency particularly improves legibility here. --Matthew
        //
        // "react/jsx-curly-spacing": ["error", {"when": "never", "children": {"when": "always"}}],

        // Assert spacing before self-closing JSX tags, and no spacing before or
        // after the closing slash, and no spacing after the opening bracket of
        // the opening tag or closing tag.
        //
        // https://github.com/yannickcr/eslint-plugin-react/blob/HEAD/docs/rules/jsx-tag-spacing.md
        "react/jsx-tag-spacing": ["error"],

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
            ignoreRegExpLiterals: true,
            code: 120,
        }],
        "valid-jsdoc": ["warn"],
        "new-cap": ["warn"],
        "key-spacing": ["warn"],
        "prefer-const": ["warn"],

        // crashes currently: https://github.com/eslint/eslint/issues/6274
        "generator-star-spacing": "off",

        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
    },
    settings: {
        flowtype: {
            onlyFilesWithFlowAnnotation: true
        },
    },
};
