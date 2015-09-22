/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

var React = require('react');

var EditableTextController = require("../../../../src/controllers/atoms/EditableText");

module.exports = React.createClass({
    displayName: 'EditableText',
    mixins: [EditableTextController],

    onKeyUp: function(ev) {
        if (ev.key == "Enter") {
            this.onFinish(ev);
        } else if (ev.key == "Escape") {
            this.cancelEdit();
        }
    },

    onClickDiv: function() {
        this.setState({
            phase: this.Phases.Edit,
        })
    },

    onFocus: function(ev) {
        ev.target.setSelectionRange(0, ev.target.value.length);
    },

    onFinish: function(ev) {
        if (ev.target.value) {
            this.setValue(ev.target.value, ev.key === "Enter");
        } else {
            this.cancelEdit();
        }
    },

    render: function() {
        var editable_el;

        if (this.state.phase == this.Phases.Display) {
            if (this.state.value) {
                editable_el = <div ref="display_div" onClick={this.onClickDiv}>{this.state.value}</div>;
            } else {
                editable_el = <div ref="display_div" onClick={this.onClickDiv}>{this.props.label}</div>;
            }
        } else if (this.state.phase == this.Phases.Edit) {
            editable_el = (
                <div>
                    <input type="text" defaultValue={this.state.value} onKeyUp={this.onKeyUp} onFocus={this.onFocus} onBlur={this.onFinish} placeholder={this.props.placeHolder} autoFocus/>
                </div>
            );
        }

        return (
            <div className="mx_EditableText">
                {editable_el}
            </div>
        );
    }
});
