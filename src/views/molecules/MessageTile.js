var React = require('react');

var classNames = require("classnames");

var ComponentBroker = require('../../ComponentBroker');

var MessageTimestamp = ComponentBroker.get('atoms/MessageTimestamp');
var SenderProfile = ComponentBroker.get('molecules/SenderProfile');

var UnknownMessageTile = ComponentBroker.get('molecules/UnknownMessageTile');

var tileTypes = {
    'm.text': ComponentBroker.get('molecules/MTextTile'),
    'm.notice': ComponentBroker.get('molecules/MNoticeTile'),
    'm.emote': ComponentBroker.get('molecules/MEmoteTile')
};

var MessageTileController = require("../../controllers/molecules/MessageTile");

module.exports = React.createClass({
    mixins: [MessageTileController],

    render: function() {
        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var TileType = UnknownMessageTile;
        if (msgtype && tileTypes[msgtype]) {
            TileType = tileTypes[msgtype];
        }
        var classes = classNames({
            mx_MessageTile: true,
            sending: this.props.mxEvent.status == 'sending',
            not_sent: this.props.mxEvent.status == 'not_sent'
        });
        return (
            <div className={classes}>
                <MessageTimestamp ts={this.props.mxEvent.getTs()} />
                <SenderProfile mxEvent={this.props.mxEvent} />
                <TileType mxEvent={this.props.mxEvent} />
            </div>
        );
    },
});

