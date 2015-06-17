var React = require('react');

var ComponentBroker = require('../ComponentBroker');

var MessageTimestamp = ComponentBroker.get('atoms/MessageTimestamp');
var SenderProfile = ComponentBroker.get('molecules/SenderProfile');

var UnknownMessageTile = ComponentBroker.get('molecules/UnknownMessageTile');

var tileTypes = {
    'm.text': ComponentBroker.get('molecules/MTextTile'),
    'm.emote': ComponentBroker.get('molecules/MEmoteTile')
};

module.exports = React.createClass({
    render: function() {
        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var TileType = UnknownMessageTile;
        if (msgtype && tileTypes[msgtype]) {
            TileType = tileTypes[msgtype];
        }
        return (
            <div className="mx_MessageTile">
                <MessageTimestamp ts={this.props.mxEvent.getTs()} />
                <SenderProfile mxEvent={this.props.mxEvent} />
                <TileType mxEvent={this.props.mxEvent} />
            </div>
        );
    },
});

