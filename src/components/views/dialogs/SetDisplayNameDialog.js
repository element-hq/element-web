/*
Copyright 2016 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var React = require("react");
var sdk = require("../../../index.js");
var MatrixClientPeg = require("../../../MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'SetDisplayNameDialog',
    propTypes: {
        onFinished: React.PropTypes.func.isRequired,
        currentDisplayName: React.PropTypes.string,
    },

    getInitialState: function() {
        if (this.props.currentDisplayName) {
            return { value: this.props.currentDisplayName };
        }

        if (MatrixClientPeg.get().isGuest()) {
            return { value : "Guest " + MatrixClientPeg.get().getUserIdLocalpart() };
        }
        else {
            return { value : MatrixClientPeg.get().getUserIdLocalpart() };
        }
    },

    componentDidMount: function() {
        this.refs.input_value.select();
    },

    getValue: function() {
        return this.state.value;
    },

    onValueChange: function(ev) {
        this.setState({
            value: ev.target.value
        });
    },

    onFormSubmit: function(ev) {
        ev.preventDefault();
        this.props.onFinished(true);
        return false;
    },

    render: function() {
        return (
            <div className="mx_SetDisplayNameDialog">
                <div className="mx_Dialog_title">
                    Set a Display Name
                </div>
                <div className="mx_Dialog_content">
                    Your display name is how you'll appear to others when you speak in rooms.<br/>
                    What would you like it to be?
                </div>
                <form onSubmit={this.onFormSubmit}>
                    <div className="mx_Dialog_content">
                        <input type="text" ref="input_value" value={this.state.value}
                            autoFocus={true} onChange={this.onValueChange} size="30"
                            className="mx_SetDisplayNameDialog_input"
                        />
                    </div>
                    <div className="mx_Dialog_buttons">
                        <input className="mx_Dialog_primary" type="submit" value="Set" />
                    </div>
                </form>
            </div>
        );
    }
});
