module.exports = function(dest, src) {
    for (var i in src) {
        if (src.hasOwnProperty(i)) {
            dest[i] = src[i];
        }
    }
    return dest;
}
