module.exports = {
    extends: ["stylelint-config-standard"],
    customSyntax: "postcss-scss",
    plugins: ["stylelint-scss", "stylelint-value-no-unknown-custom-properties"],
    rules: {
        "comment-empty-line-before": null,
        "declaration-empty-line-before": null,
        "length-zero-no-unit": null,
        "rule-empty-line-before": null,
        "color-hex-length": null,
        "at-rule-no-unknown": null,
        "no-descending-specificity": null,
        "scss/at-rule-no-unknown": [
            true,
            {
                // https://github.com/vector-im/element-web/issues/10544
                ignoreAtRules: ["define-mixin"],
            },
        ],
        // Disable `&_kind`-style selectors while our unused CSS approach is "Find & Replace All"
        // rather than a CI thing. Shorthand selectors are harder to detect when searching for a
        // class name. This regex is trying to *allow* anything except `&words`, such as `&::before`,
        // `&.mx_Class`, etc.
        "selector-nested-pattern": "^((&[ :.\\[,])|([^&]))",
        // Disable some defaults
        "selector-class-pattern": null,
        "custom-property-pattern": null,
        "selector-id-pattern": null,
        "keyframes-name-pattern": null,
        "alpha-value-notation": null,
        "color-function-notation": null,
        "selector-not-notation": null,
        "import-notation": null,
        "value-keyword-case": null,
        "declaration-block-no-redundant-longhand-properties": null,
        "shorthand-property-no-redundant-values": null,
        "property-no-vendor-prefix": null,
        "selector-no-vendor-prefix": null,
        "media-feature-name-no-vendor-prefix": null,
        "number-max-precision": null,
        "no-invalid-double-slash-comments": true,
        "media-feature-range-notation": null,
        "declaration-property-value-no-unknown": null,
        "declaration-property-value-keyword-no-deprecated": null,
        "csstools/value-no-unknown-custom-properties": [
            true,
            {
                importFrom: [
                    { from: "res/css/_common.pcss", type: "css" },
                    { from: "res/themes/light/css/_light.pcss", type: "css" },
                    // Right now our styles share vars all over the place, this is not ideal but acceptable for now
                    { from: "res/css/views/rooms/_EventTile.pcss", type: "css" },
                    { from: "res/css/views/rooms/_IRCLayout.pcss", type: "css" },
                    { from: "res/css/views/rooms/_EventBubbleTile.pcss", type: "css" },
                    { from: "res/css/views/rooms/_ReadReceiptGroup.pcss", type: "css" },
                    { from: "res/css/views/rooms/_EditMessageComposer.pcss", type: "css" },
                    { from: "res/css/views/right_panel/_BaseCard.pcss", type: "css" },
                    { from: "res/css/views/messages/_MessageTimestamp.pcss", type: "css" },
                    { from: "res/css/views/messages/_EventTileBubble.pcss", type: "css" },
                    { from: "res/css/views/messages/_MessageActionBar.pcss", type: "css" },
                    { from: "res/css/views/voip/LegacyCallView/_LegacyCallViewButtons.pcss", type: "css" },
                    { from: "res/css/views/elements/_ToggleSwitch.pcss", type: "css" },
                    { from: "res/css/views/settings/tabs/_SettingsTab.pcss", type: "css" },
                    { from: "res/css/structures/_RoomView.pcss", type: "css" },
                    // Compound vars
                    "node_modules/@vector-im/compound-design-tokens/assets/web/css/cpd-common-base.css",
                    "node_modules/@vector-im/compound-design-tokens/assets/web/css/cpd-common-semantic.css",
                    "node_modules/@vector-im/compound-design-tokens/assets/web/css/cpd-theme-light-base-mq.css",
                    "node_modules/@vector-im/compound-design-tokens/assets/web/css/cpd-theme-light-semantic-mq.css",
                ],
            },
        ],
    },
};
