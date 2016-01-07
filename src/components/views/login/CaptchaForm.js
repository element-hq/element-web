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
var DIV_ID = 'mx_recaptcha';

/**
 * A pure UI component which displays a captcha form.
 */
module.exports = React.createClass({
    displayName: 'CaptchaForm',

    propTypes: {
        onCaptchaLoaded: React.PropTypes.func.isRequired // called with div id name
    },

    getDefaultProps: function() {
        return {
            onCaptchaLoaded: function() {
                console.error("Unhandled onCaptchaLoaded");
            }
        };
    },

    componentDidMount: function() {
        // Just putting a script tag into the returned jsx doesn't work, annoyingly,
        // so we do this instead.
        var self = this;
        if (this.refs.recaptchaContainer) {
            console.log("Loading recaptcha script...");
            var scriptTag = document.createElement('script');
            window.mx_on_recaptcha_loaded = function() {
                console.log("Loaded recaptcha script.");
                self.props.onCaptchaLoaded(DIV_ID);
            };
            scriptTag.setAttribute(
                'src', global.location.protocol+"//www.google.com/recaptcha/api.js?onload=mx_on_recaptcha_loaded&render=explicit"
            );
            this.refs.recaptchaContainer.appendChild(scriptTag);
        }
    },

    render: function() {
        // FIXME: Tight coupling with the div id and SignupStages.js
        return (
            <div ref="recaptchaContainer">
                This Home Server would like to make sure you are not a robot
                <div id={DIV_ID}></div>
            </div>
        );
    }
});