// Stub out FontManager for tests as it doesn't validate anything we don't already know given
// our fixed test environment and it requires the installation of node-canvas.

module.exports = {
    fixupColorFonts: () => Promise.resolve(),
};
