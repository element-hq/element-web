/*
Copyright 2015, 2016 OpenMarket Ltd

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

module.exports = React.createClass({
    displayName: 'CompatibilityPage',
    propTypes: {
        onAccept: React.PropTypes.func
    },

    getDefaultProps: function() {
        return {
            onAccept: function() {} // NOP
        };
    },

    onAccept: function() {
        this.props.onAccept();
    },

    render: function() {

        return (
        <div className="mx_CompatibilityPage">
            <div className="mx_CompatibilityPage_box">
                <p>Sorry, your browser is <b>not</b> able to run Vector.</p>
                <p>
                Buttons and images may appear out of place, communication may
                not be possible and all manner of chaos may be unleashed.
                </p>
                <p>
                Please install <a href={"https://www.google.com/chrome"}>Chrome</a> for
                the best experience.
                </p>
                <p>
                Though if you like taking risks with your life, you can still try it
                out by clicking that you understand the risks involved.
                </p>
                <button onClick={this.onAccept}>
                    I understand the risks and wish to continue
                </button>
            </div>
        </div>
        );
    }
});
