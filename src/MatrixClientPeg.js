// A thing that holds your Matrix Client
var Matrix = require("matrix-js-sdk");

var matrixClient = null;

var localStorage = window.localStorage;
if (localStorage) {
    var hs_url = localStorage.getItem("mx_hs_url");
    var access_token = localStorage.getItem("mx_access_token");
    var user_id = localStorage.getItem("mx_user_id");
    if (access_token && user_id && hs_url) {
        matrixClient = Matrix.createClient({
            baseUrl: hs_url,
            accessToken: access_token,
            userId: user_id
        });
        matrixClient.startClient();
    }
}

module.exports = {
    get: function() {
        return matrixClient;
    },

    replace: function(cli) {
        matrixClient = cli;
    },

    replaceUsingUrl: function(hs_url) {
        matrixClient = Matrix.createClient(hs_url);
    }
};

