/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
        // Resettting the captcha does not clear the challenge overlay from the body in android webviews.
        // Search for an iframe with the challenge src and remove it's topmost ancestor from the body.
        // TODO: Remove this when the "mobile_register" page is retired.
        const iframes = document.querySelectorAll("iframe");
        for (const iframe of iframes) {
            if (iframe.src.includes("https://www.recaptcha.net/recaptcha/api2/bframe")) {
                let parentBeforeBody: HTMLElement | null = iframe;
                do {
                    parentBeforeBody = parentBeforeBody.parentElement;
                } while (parentBeforeBody?.parentElement && parentBeforeBody.parentElement != document.body);
                parentBeforeBody?.remove();
            }
        }
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
                errorText: e instanceof Error ? e.message : String(e),
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
                <p>{_t("auth|captcha_description")}</p>
                <div id={DIV_ID} />
                {error}
            </div>
        );
    }
}
