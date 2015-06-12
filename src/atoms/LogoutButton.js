var React = require('react');

var mxCliPeg = require("../MatrixClientPeg");

var dis = require("../dispatcher");

module.exports = React.createClass({
    onClick: function() {
        dis.dispatch({
            action: 'logout'
        });
    },

    render: function() {
        return (
            <button className="mx_LogoutButton" onClick={this.onClick}>Sign out</button>
        );
    }
});
