var React = require('react');
var MatrixClientPeg = require("../MatrixClientPeg");
var Matrix = require("matrix-js-sdk");

var ServerConfig = require("../molecules/ServerConfig");
var ProgressBar = require("../molecules/ProgressBar");
var Loader = require("react-loader");

var dis = require("../dispatcher");

module.exports = React.createClass({
    getInitialState: function() {
        return {
            step: 'choose_hs',
            busy: false,
            currentStep: 0,
            totalSteps: 1
        };
    },

    setStep: function(step) {
        this.setState({ step: step, errorText: '' });
    },

    onHSChosen: function(ev) {
        MatrixClientPeg.replaceUsingUrl(this.refs.serverConfig.getHsUrl());
        this.setStep("fetch_stages");
        var cli = MatrixClientPeg.get();
        var that = this;
        cli.loginFlows().then(function(result) {
            that.setState({
                flows: result.flows,
                currentStep: 1,
                totalSteps: result.flows.length+1
            });
            that.setStep('stage_'+result.flows[0].type);
        }, function(error) {
            that.setStep("choose_hs");
            that.setState({errorText: 'Unable to contact the given Home Server'});
        });
    },

    onUserPassEntered: function(ev) {
        var that = this;
        MatrixClientPeg.get().login('m.login.password', {
            'user': that.refs.user.getDOMNode().value,
            'password': that.refs.pass.getDOMNode().value
        }).then(function(data) {
            dis.dispatch({
                'action': 'logged_in'
            });
        }, function(error) {
            that.setStep("stage_m.login.password");
            that.setState({errorText: 'Login failed.'});
        });
    },

    componentForStep: function(step) {
        switch (step) {
            case 'choose_hs':
                return (
                    <div>
                        <form onSubmit={this.onHSChosen}>
                        <ServerConfig ref="serverConfig" />
                        <input type="submit" value="Continue" />
                        </form>
                    </div>
                );
            // XXX: clearly these should be separate organisms
            case 'stage_m.login.password':
                return (
                    <div>
                        <form onSubmit={this.onUserPassEntered}>
                        <input ref="user" type="text" placeholder="username" /><br />
                        <input ref="pass" type="password" placeholder="password" /><br />
                        <input type="submit" value="Log in" />
                        </form>
                    </div>
                );
        }
    },

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
