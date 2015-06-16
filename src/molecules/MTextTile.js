var React = require('react');

module.exports = React.createClass({
    render: function() {
        var content = this.props.mxEvent.getContent();
        return (
            <span className="mx_MTextTile">
                {content.body}
            </span>
        );
    },
});

