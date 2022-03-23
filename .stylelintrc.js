module.exports = {
    "extends": "stylelint-config-standard",
    "plugins": [
        "stylelint-scss",
    ],
    "rules": {
        "color-hex-case": null,
        "indentation": 4,
        "comment-empty-line-before": null,
        "declaration-empty-line-before": null,
        "length-zero-no-unit": null,
        "rule-empty-line-before": null,
        "color-hex-length": null,
        "max-empty-lines": 1,
        "no-eol-whitespace": true,
        "number-no-trailing-zeros": null,
        "number-leading-zero": null,
        "selector-list-comma-newline-after": null,
        "at-rule-no-unknown": null,
        "no-descending-specificity": null,
        "no-empty-first-line": true,
        "scss/at-rule-no-unknown": [true, {
            // https://github.com/vector-im/element-web/issues/10544
            "ignoreAtRules": ["define-mixin"],
        }],
        // Disable `&_kind`-style selectors while our unused CSS approach is "Find & Replace All"
        // rather than a CI thing. Shorthand selectors are harder to detect when searching for a
        // class name. This regex is trying to *allow* anything except `&words`, such as `&::before`,
        // `&.mx_Class`, etc.
        "selector-nested-pattern": "^((&[ :.\\\[,])|([^&]))"
    }
}
