module.exports = {
    env: {
        mocha: true,
    },

    // mocha defines a 'this'
    rules: {
        "babel/no-invalid-this": "off",
    },
};
