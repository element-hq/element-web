var React = require('react');

var MNoticeTileController = require("../../controllers/molecules/MNoticeTile");

module.exports = React.createClass({
    mixins: [MNoticeTileController],

    render: function() {
        var content = this.props.mxEvent.getContent();
        return (
            <span className="mx_MNoticeTile">
                {content.body}
            </span>
        );
    },
});

