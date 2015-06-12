var React = require('react');

var LogoutButton = require("../atoms/LogoutButton");

module.exports = React.createClass({
    render: function() {
        return (
            <div className="mx_MatrixToolbar">
                <LogoutButton />
            </div>
        );
    }
});

