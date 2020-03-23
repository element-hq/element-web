if (typeof window.Object.fromEntries !== "function") {
    // From https://github.com/feross/fromentries/blob/master/index.js
    window.Object.fromEntries = function fromEntries(iterable) {
        return [...iterable].reduce((obj, [key, val]) => {
            obj[key] = val;
            return obj;
        }, {});
    };
}
