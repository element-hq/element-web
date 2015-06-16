var React = require('react');

module.exports = React.createClass({
    render: function() {
        var mxEvent = this.props.mxEvent;
        var content = mxEvent.getContent();
        var name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
        return (
            <span className="mx_MEmoteTile">
                {name} {content.body}
            </span>
        );
    },
});

