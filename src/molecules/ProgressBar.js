var React = require('react');

module.exports = React.createClass({
    propTypes: {
        value: React.PropTypes.number,
        max: React.PropTypes.number
    },

    render: function() {
        // Would use an HTML5 progress tag but if that doesn't animate if you
        // use the HTML attributes rather than styles
        var progressStyle = {
            width: ((this.props.value / this.props.max) * 100)+"%"
        };
        return (
            <div className="mx_ProgressBar"><div className="mx_ProgressBar_fill" style={progressStyle}></div></div>
        );
    }
});
