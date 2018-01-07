module.exports = {
    plugins: [
        require("postcss-import")(),
        require("postcss-mixins")(),
        require("autoprefixer")(),
        require("postcss-simple-vars")(),
        require("postcss-extend")(),
        require("postcss-nested")(),
        require("postcss-strip-inline-comments")(),
    ],
    "parser": "postcss-scss",
    "local-plugins": true,
};
