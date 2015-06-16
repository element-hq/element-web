var React = require('react');

var MessageTimestamp = require('../atoms/MessageTimestamp');
var SenderProfile = require('../molecules/SenderProfile');

var UnknownMessageTile = require('../molecules/UnknownMessageTile');

var tileTypes = {
    'm.text': require('../molecules/MTextTile')
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

