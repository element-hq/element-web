var React = require('react');

var MEmoteTileController = require("../../../../src/controllers/molecules/MEmoteTile");

module.exports = React.createClass({
    displayName: 'MEmoteTile',
    mixins: [MEmoteTileController],

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

