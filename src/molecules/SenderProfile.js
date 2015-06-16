var React = require('react');

module.exports = React.createClass({
    render: function() {
        var mxEvent = this.props.mxEvent;
        var name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();

        var msgtype = mxEvent.getContent().msgtype;
        if (msgtype && msgtype == 'm.emote') {
            name = ''; // emote message must include the name so don't duplicate it
        }
        return (
            <span className="mx_SenderProfile">
                {name}
            </span>
        );
    },
});

