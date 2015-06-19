var React = require('react');

var ComponentBroker = require("../../ComponentBroker");

var ProgressBar = ComponentBroker.get("molecules/ProgressBar");
var Loader = require("react-loader");

var LoginController = require("../../controllers/templates/Login");

module.exports = React.createClass({
    mixins: [LoginController],

    loginContent: function() {
        if (this.state.busy) {
            return (
                <Loader />
            );
        } else {
            return (
                <div>
                    <h1>Please log in:</h1>
                    {this.componentForStep(this.state.step)}
                    <div className="error">{this.state.errorText}</div>
                </div>
            );
        }
    },

    render: function() {
        return (
            <div className="mx_Login">
            <ProgressBar value={this.state.currentStep} max={this.state.totalSteps} />
            {this.loginContent()}
            </div>
        );
    }
});
