var React = require('react');

module.exports = React.createClass({
    render: function() {
                //{this.props.mxEvent.getContent().body}
        return (
            <div className="mx_MessageTile">
                {JSON.stringify(this.props.mxEvent.getContent())}
            </div>
        );
    },
});

