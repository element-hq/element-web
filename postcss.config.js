module.exports = {
    plugins: [
        require("postcss-import")(),
        require("autoprefixer")(),
        require("postcss-simple-vars")(),
        require("postcss-extend")(),
        require("postcss-nested")(),
        require("postcss-mixins")(),
        require("postcss-easings")(),
        require("postcss-strip-inline-comments")(),
    ],
    "parser": "postcss-scss",
    "local-plugins": true,
};
