var React = require('react');
var MatrixClientPeg = require("../MatrixClientPeg");

var HomeServerTextBox = require("../molecules/HomeServerTextBox");
var Loader = require("react-loader");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            step: 'choose_hs'
        };
    },

    setStep: function(step) {
        this.setState({ step: step });
    },

    onHSChosen: function(ev) {
        this.setStep("fetch_stages");
    },

    render: function() {
        switch (this.state.step) {
            case 'choose_hs':
                return (
                    <div>
                        <div>Please log in:</div>
                        <HomeServerTextBox />
                        <button onClick={this.onHSChosen}>Continue</button>
                    </div>
                );
            case 'fetch_stages':
                return (
                    <Loader />
                );
        }
    }
});
