module.exports = {
    "extends": ["matrix-org", "matrix-org/react"],
    "env": {
        "browser": true,
        "node": true,
    },
    "rules": {
        "quotes": "off",
    },
    "overrides": [{
        "files": ["src/**/*.{ts,tsx}"],
        "extends": ["matrix-org/ts", "matrix-org/react"],
        "env": {
            "browser": true,
        },
        "rules": {
            "quotes": "off",
            // While converting to ts we allow this
            "@typescript-eslint/no-explicit-any": "off",
            "prefer-promise-reject-errors": "off",
        },
    }],
};
