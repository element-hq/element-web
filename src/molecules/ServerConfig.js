var React = require('react');

var MatrixClientPeg = require("../MatrixClientPeg.js");

module.exports = React.createClass({
    getDefaultProps: function() {
        return {
            default_url: 'https://matrix.org/'
        };
    },

    getInitialState: function() {
        return {
            hs_url: this.props.default_url
        }
    },

    hsChanged: function(ev) {
        this.state.hs_url = ev.target.value;
        MatrixClientPeg.replaceUsingUrl(this.state.hs_url);
    },

    render: function() {
        return (
            <div className="HomeServerTextBox">
                Home Server URL:&nbsp;
                <input type="text" value={this.state.hs_url} onChange={this.hsChanged} />
            </div>
        );
    }
});
