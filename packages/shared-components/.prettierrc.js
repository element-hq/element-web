// Even though this (at time of writing) is identical Element Web's
// .prettierrc.js, shared components needs its own because otherwise
// this refers to element web's copy of eslint-plugin-matrix-org which
// would require element-web's modules to be installed.
module.exports = require("eslint-plugin-matrix-org/.prettierrc.js");
