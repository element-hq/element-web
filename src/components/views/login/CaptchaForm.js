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
        sitePublicKey: React.PropTypes.string,

        // called with the captcha response
        onCaptchaResponse: React.PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            onCaptchaResponse: () => {},
        };
    },

    getInitialState: function() {
        return {
            errorText: null,
        };
    },

    componentDidMount: function() {
        // Just putting a script tag into the returned jsx doesn't work, annoyingly,
        // so we do this instead.
        if (global.grecaptcha) {
            // already loaded
            this._onCaptchaLoaded();
        } else {
            console.log("Loading recaptcha script...");
            window.mx_on_recaptcha_loaded = () => {this._onCaptchaLoaded();};
            var protocol = global.location.protocol;
            if (protocol === "file:") {
                var warning = document.createElement('div');
                // XXX: fix hardcoded app URL.  Better solutions include:
                // * jumping straight to a hosted captcha page (but we don't support that yet)
                // * embedding the captcha in an iframe (if that works)
                // * using a better captcha lib
                warning.innerHTML = "Robot check is currently unavailable on desktop - please use a <a href='https://riot.im/app'>web browser</a>.";
                this.refs.recaptchaContainer.appendChild(warning);
            }
            else {
                var scriptTag = document.createElement('script');
                scriptTag.setAttribute(
                    'src', protocol+"//www.google.com/recaptcha/api.js?onload=mx_on_recaptcha_loaded&render=explicit"
                );
                this.refs.recaptchaContainer.appendChild(scriptTag);
            }
        }
    },

    _renderRecaptcha: function(divId) {
        if (!global.grecaptcha) {
            console.error("grecaptcha not loaded!");
            throw new Error("Recaptcha did not load successfully");
        }

        var publicKey = this.props.sitePublicKey;
        if (!publicKey) {
            console.error("No public key for recaptcha!");
            throw new Error(
                "This server has not supplied enough information for Recaptcha "
                    + "authentication");
        }

        console.log("Rendering to %s", divId);
        global.grecaptcha.render(divId, {
            sitekey: publicKey,
            callback: this.props.onCaptchaResponse,
        });
    },

    _onCaptchaLoaded: function() {
        console.log("Loaded recaptcha script.");
        try {
            this._renderRecaptcha(DIV_ID);
        } catch (e) {
            this.setState({
                errorText: e.toString(),
            });
        }
    },

    render: function() {
        let error = null;
        if (this.state.errorText) {
            error = (
                <div className="error">
                    {this.state.errorText}
                </div>
            );
        }

        return (
            <div ref="recaptchaContainer">
                This Home Server would like to make sure you are not a robot
                <br/>
                <div id={DIV_ID}></div>
                {error}
            </div>
        );
    }
});
