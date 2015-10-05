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

var RoomAliasController = require('matrix-react-sdk/lib/controllers/atoms/create_room/RoomAlias')

module.exports = React.createClass({
    displayName: 'RoomAlias',
    mixins: [RoomAliasController],

    onValueChanged: function(ev) {
        this.props.onChange(ev.target.value);
    },

    onFocus: function(ev) {
        var target = ev.target;
        var curr_val = ev.target.value;

        if (this.props.homeserver) {
            if (curr_val == "") {
                setTimeout(function() {
                    target.value = "#:" + this.props.homeserver;
                    target.setSelectionRange(1, 1);
                }, 0);
            } else {
                var suffix = ":" + this.props.homeserver;
                setTimeout(function() {
                    target.setSelectionRange(
                        curr_val.startsWith("#") ? 1 : 0,
                        curr_val.endsWith(suffix) ? (target.value.length - suffix.length) : target.value.length
                    );
                }, 0);
            }
        }
    },

    onBlur: function(ev) {
        var curr_val = ev.target.value;

        if (this.props.homeserver) {
            if (curr_val == "#:" + this.props.homeserver) {
                ev.target.value = "";
                return;
            }

            if (curr_val != "") {
                var new_val = ev.target.value;
                var suffix = ":" + this.props.homeserver;
                if (!curr_val.startsWith("#")) new_val = "#" + new_val;
                if (!curr_val.endsWith(suffix)) new_val = new_val + suffix;
                ev.target.value = new_val;
            }
        }
    },

    render: function() {
        return (
            <input type="text" className="mx_RoomAlias" placeholder="Alias (optional)"
                onChange={this.onValueChanged} onFocus={this.onFocus} onBlur={this.onBlur}
                value={this.props.alias}/>
        );
    }
});
