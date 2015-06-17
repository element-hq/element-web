var React = require('react');

var ComponentBroker = require('../ComponentBroker');

var LogoutButton = ComponentBroker.get("atoms/LogoutButton");

module.exports = React.createClass({
    render: function() {
        return (
            <div className="mx_MatrixToolbar">
                <LogoutButton />
            </div>
        );
    }
});

