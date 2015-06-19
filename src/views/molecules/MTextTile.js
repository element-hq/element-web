var React = require('react');

var MTextTileController = require("../../controllers/molecules/MTextTile");

module.exports = React.createClass({
    mixins: [MTextTileController],

    render: function() {
        var content = this.props.mxEvent.getContent();
        return (
            <span className="mx_MTextTile">
                {content.body}
            </span>
        );
    },
});

