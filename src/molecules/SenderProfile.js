var React = require('react');

module.exports = React.createClass({
    render: function() {
        var mxEvent = this.props.mxEvent;
        var name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
        return (
            <span className="mx_SenderProfile">
                {name}
            </span>
        );
    },
});

