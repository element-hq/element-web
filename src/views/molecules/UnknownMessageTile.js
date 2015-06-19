var React = require('react');

var UnknownMessageTileController = require("../../controllers/molecules/UnknownMessageTile");

module.exports = React.createClass({
    mixins: [UnknownMessageTileController],

    render: function() {
        return (
            <span className="mx_UnknownMessageTile">
                ?
            </span>
        );
    },
});
