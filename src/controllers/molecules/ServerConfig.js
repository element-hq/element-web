var React = require("react");

module.exports = {
    propTypes: {
        onHsUrlChanged: React.PropTypes.func,
        onIsUrlChanged: React.PropTypes.func,
        default_hs_url: React.PropTypes.string,
        default_is_url: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            onHsUrlChanged: function() {},
            onIsUrlChanged: function() {},
            default_hs_url: 'https://matrix.org/',
            default_is_url: 'https://matrix.org/'
        };
    },

    getInitialState: function() {
        return {
            hs_url: this.props.default_hs_url,
            is_url: this.props.default_is_url,
        }
    },

    hsChanged: function(ev) {
        this.setState({hs_url: ev.target.value});
        this.props.onHsUrlChanged(this.state.hs_url);
    },

    isChanged: function(ev) {
        this.setState({is_url: ev.target.value});
        this.props.onIsUrlChanged(this.state.is_url);
    },

    getHsUrl: function() {
        return this.state.hs_url;
    },

    getIsUrl: function() {
        return this.state.is_url;
    },
};
