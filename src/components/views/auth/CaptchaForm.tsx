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

import React, { createRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";

const DIV_ID = "mx_recaptcha";

interface ICaptchaFormProps {
    sitePublicKey: string;
    onCaptchaResponse: (response: string) => void;
}

interface ICaptchaFormState {
    errorText?: string;
}

/**
 * A pure UI component which displays a captcha form.
 */
export default class CaptchaForm extends React.Component<ICaptchaFormProps, ICaptchaFormState> {
    public static defaultProps = {
        onCaptchaResponse: () => {},
    };

    private captchaWidgetId?: string;
    private recaptchaContainer = createRef<HTMLDivElement>();

    public constructor(props: ICaptchaFormProps) {
        super(props);

        this.state = {
            errorText: undefined,
        };
    }

    public componentDidMount(): void {
        // Just putting a script tag into the returned jsx doesn't work, annoyingly,
        // so we do this instead.
        if (this.isRecaptchaReady()) {
            // already loaded
            this.onCaptchaLoaded();
        } else {
            logger.log("Loading recaptcha script...");
            window.mxOnRecaptchaLoaded = () => {
                this.onCaptchaLoaded();
            };
            const scriptTag = document.createElement("script");
            scriptTag.setAttribute(
                "src",
                `https://www.recaptcha.net/recaptcha/api.js?onload=mxOnRecaptchaLoaded&render=explicit`,
            );
            this.recaptchaContainer.current?.appendChild(scriptTag);
        }
    }

    public componentWillUnmount(): void {
        this.resetRecaptcha();
    }

    // Borrowed directly from: https://github.com/codeep/react-recaptcha-google/commit/e118fa5670fa268426969323b2e7fe77698376ba
    private isRecaptchaReady(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof global.grecaptcha !== "undefined" &&
            typeof global.grecaptcha.render === "function"
        );
    }

    private renderRecaptcha(divId: string): void {
        if (!this.isRecaptchaReady()) {
            logger.error("grecaptcha not loaded!");
            throw new Error("Recaptcha did not load successfully");
        }

        const publicKey = this.props.sitePublicKey;
        if (!publicKey) {
            logger.error("No public key for recaptcha!");
            throw new Error("This server has not supplied enough information for Recaptcha authentication");
        }

        logger.info(`Rendering to ${divId}`);
        this.captchaWidgetId = global.grecaptcha?.render(divId, {
            sitekey: publicKey,
            callback: this.props.onCaptchaResponse,
        });
    }

    private resetRecaptcha(): void {
        if (this.captchaWidgetId) {
            global?.grecaptcha?.reset(this.captchaWidgetId);
        }
    }

    private onCaptchaLoaded(): void {
        logger.log("Loaded recaptcha script.");
        try {
            this.renderRecaptcha(DIV_ID);
            // clear error if re-rendered
            this.setState({
                errorText: undefined,
            });
        } catch (e) {
            this.setState({
                errorText: e.toString(),
            });
        }
    }

    public render(): React.ReactNode {
        let error: JSX.Element | undefined;
        if (this.state.errorText) {
            error = <div className="error">{this.state.errorText}</div>;
        }

        return (
            <div ref={this.recaptchaContainer}>
                <p>{_t("This homeserver would like to make sure you are not a robot.")}</p>
                <div id={DIV_ID} />
                {error}
            </div>
        );
    }
}
