var React = require('react');

var ComponentBroker = require('../../../../src/ComponentBroker');

var LogoutButton = ComponentBroker.get("atoms/LogoutButton");

var MatrixToolbarController = require("../../../../src/controllers/molecules/MatrixToolbar");

module.exports = React.createClass({
    displayName: 'MatrixToolbar',
    mixins: [MatrixToolbarController],

    render: function() {
        return (
            <div className="mx_MatrixToolbar">
                <LogoutButton />
            </div>
        );
    }
});

