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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';

const DIV_ID = 'mx_recaptcha';

/**
 * A pure UI component which displays a captcha form.
 */
export default class CaptchaForm extends React.Component {
    static propTypes = {
        sitePublicKey: PropTypes.string,

        // called with the captcha response
        onCaptchaResponse: PropTypes.func,
    };

    static defaultProps = {
        onCaptchaResponse: () => {},
    };

    constructor(props) {
        super(props);

        this.state = {
            errorText: null,
        };

        this._captchaWidgetId = null;

        this._recaptchaContainer = createRef();
    }

    componentDidMount() {
        // Just putting a script tag into the returned jsx doesn't work, annoyingly,
        // so we do this instead.
        if (global.grecaptcha) {
            // already loaded
            this._onCaptchaLoaded();
        } else {
            console.log("Loading recaptcha script...");
            window.mx_on_recaptcha_loaded = () => {this._onCaptchaLoaded();};
            const scriptTag = document.createElement('script');
            scriptTag.setAttribute(
                'src', `https://www.recaptcha.net/recaptcha/api.js?onload=mx_on_recaptcha_loaded&render=explicit`,
            );
            this._recaptchaContainer.current.appendChild(scriptTag);
        }
    }

    componentWillUnmount() {
        this._resetRecaptcha();
    }

    _renderRecaptcha(divId) {
        if (!global.grecaptcha) {
            console.error("grecaptcha not loaded!");
            throw new Error("Recaptcha did not load successfully");
        }

        const publicKey = this.props.sitePublicKey;
        if (!publicKey) {
            console.error("No public key for recaptcha!");
            throw new Error(
                "This server has not supplied enough information for Recaptcha "
                    + "authentication");
        }

        console.info("Rendering to %s", divId);
        this._captchaWidgetId = global.grecaptcha.render(divId, {
            sitekey: publicKey,
            callback: this.props.onCaptchaResponse,
        });
    }

    _resetRecaptcha() {
        if (this._captchaWidgetId !== null) {
            global.grecaptcha.reset(this._captchaWidgetId);
        }
    }

    _onCaptchaLoaded() {
        console.log("Loaded recaptcha script.");
        try {
            this._renderRecaptcha(DIV_ID);
        } catch (e) {
            this.setState({
                errorText: e.toString(),
            });
        }
    }

    render() {
        let error = null;
        if (this.state.errorText) {
            error = (
                <div className="error">
                    { this.state.errorText }
                </div>
            );
        }

        return (
            <div ref={this._recaptchaContainer}>
                <p>{_t(
                    "This homeserver would like to make sure you are not a robot.",
                )}</p>
                <div id={DIV_ID} />
                { error }
            </div>
        );
    }
}
