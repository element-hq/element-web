var dis = require("../../dispatcher");

module.exports = {
    onClick: function() {
        dis.dispatch({
            action: 'logout'
        });
    },
};
