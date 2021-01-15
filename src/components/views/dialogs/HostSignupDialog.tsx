/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import AccessibleButton from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import PersistedElement from "../elements/PersistedElement";
import QuestionDialog from './QuestionDialog';
import SdkConfig from "../../../SdkConfig";
import {_t} from "../../../languageHandler";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {HostSignupStore} from "../../../stores/HostSignupStore";
import {OwnProfileStore} from "../../../stores/OwnProfileStore";
import {
    IHostSignupConfig,
    IPostmessage,
    IPostmessageResponseData,
    PostmessageAction,
} from "./HostSignupDialogTypes";

interface IProps {}

interface IState {
    completed: boolean;
    error: string;
    loadIframe: boolean;
    minimized: boolean;
    termsAccepted: boolean;
}

export default class HostSignupDialog extends React.PureComponent<IProps, IState> {
    private iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();
    private readonly config: IHostSignupConfig;

    constructor(props: IProps) {
        super(props);

        this.state = {
            completed: false,
            error: null,
            loadIframe: false,
            minimized: false,
            termsAccepted: false,
        };

        this.config = SdkConfig.get().hostSignup;
    }

    private messageHandler = async (message: IPostmessage) => {
        if (!this.config.url.startsWith(message.origin)) {
            return;
        }
        switch (message.data.action) {
            case PostmessageAction.HostSignupAccountDetailsRequest:
                await this.sendAccountDetails();
                break;
            case PostmessageAction.Maximize:
                this.maximizeDialog();
                break;
            case PostmessageAction.Minimize:
                this.minimizeDialog();
                break;
            case PostmessageAction.SetupComplete:
                // Set as completed but let the user close the modal themselves
                // so they have time to finish reading any information
                this.setState({
                    completed: true,
                });
                break;
            case PostmessageAction.CloseDialog:
                return this.closeDialog();
        }
    }

    private maximizeDialog = () => {
        if (this.state.minimized) {
            this.setState({
                minimized: false,
            });
        }
    }

    private minimizeDialog = () => {
        this.setState({
            minimized: true,
        });
    }

    private closeDialog = async () => {
        window.removeEventListener("message", this.messageHandler);
        // Ensure we destroy the host signup persisted element
        PersistedElement.destroyElement("host_signup");
        // Finally clear the flag in
        return HostSignupStore.instance.setHostSignupActive(false);
    }

    private onCloseClick = async () => {
        if (this.state.completed) {
            // We're done, close
            return this.closeDialog();
        } else {
            Modal.createDialog(
                QuestionDialog,
                {
                    title: _t("Confirm Abort Of Host Creation"),
                    description: _t(
                        "Are you sure you wish to abort creation of the host? The process cannot be continued.",
                    ),
                    button: _t("Abort"),
                    onFinished: result => {
                        if (result) {
                            return this.closeDialog();
                        }
                    },
                },
            );
        }
    }

    private sendMessage = (message: IPostmessageResponseData) => {
        this.iframeRef.current.contentWindow.postMessage(message, this.config.url);
    }

    private async sendAccountDetails() {
        const openIdToken = await MatrixClientPeg.get().getOpenIdToken();
        if (!openIdToken || !openIdToken.access_token) {
            this.setState({
                completed: true,
                error: _t("Failed to connect to your homeserver. Please close this dialog and try again."),
            });
            return;
        }
        this.sendMessage({
            action: PostmessageAction.HostSignupAccountDetails,
            account: {
                accessToken: await MatrixClientPeg.get().getAccessToken(),
                name: OwnProfileStore.instance.displayName,
                openIdToken: openIdToken.access_token,
                serverName: await MatrixClientPeg.get().getDomain(),
                userLocalpart: await MatrixClientPeg.get().getUserIdLocalpart(),
                termsAccepted: this.state.termsAccepted,
            },
        });
    }

    private loadIframe = () => {
        window.addEventListener("message", this.messageHandler);
        this.setState({
            loadIframe: true,
        });
    }

    private onStartClick = () => {
        Modal.createDialog(
            QuestionDialog,
            {
                title: this.config.termsDialog.title,
                description: this.config.termsDialog.text,
                button: this.config.termsDialog.acceptText,
                onFinished: result => {
                    if (result) {
                        this.setState({
                            termsAccepted: true,
                        });
                        this.loadIframe();
                    }
                },
            },
        );
    }

    public componentWillUnmount() {
        if (HostSignupStore.instance.isHostSignupActive) {
            // Run the close dialog actions if we're still active, otherwise good to go
            return this.closeDialog();
        }
    }

    public render(): React.ReactNode {
        return (
            <div className="mx_HostSignup_persisted">
                <PersistedElement key="host_signup" persistKey="host_signup">
                    <div className={this.state.minimized ? "" : "mx_Dialog_wrapper"}>
                        <div className={["mx_Dialog",
                            this.state.minimized ? "mx_HostSignupDialog_minimized" : "mx_HostSignupDialog"].join(" ")
                        }>
                            {this.state.loadIframe &&
                                <>
                                    {this.state.minimized &&
                                        <div className="mx_Dialog_header mx_Dialog_headerWithButton">
                                            <div className="mx_Dialog_title">
                                                {this.config.minimizedDialogTitle}
                                            </div>
                                            <AccessibleButton
                                                className="mx_HostSignup_maximize_button"
                                                onClick={this.maximizeDialog}
                                                aria-label={_t("Maximize dialog")}
                                            />
                                        </div>
                                    }
                                    {!this.state.minimized &&
                                        <div className="mx_Dialog_header mx_Dialog_headerWithCancel">
                                            <AccessibleButton
                                                onClick={this.onCloseClick} className="mx_Dialog_cancelButton"
                                                aria-label={_t("Close dialog")}
                                            />
                                        </div>
                                    }
                                    <iframe
                                        src={this.config.url}
                                        ref={this.iframeRef}
                                        sandbox="allow-forms allow-scripts allow-same-origin"
                                    />
                                </>
                            }
                            {!this.state.loadIframe &&
                                <div className="mx_HostSignupDialog_info">
                                    {this.config.info.image &&
                                        <img
                                            alt={this.config.info.image.alt}
                                            height={this.config.info.image.height}
                                            src={this.config.info.image.src}
                                            width={this.config.info.image.width}
                                        />
                                    }
                                    <div className="mx_HostSignupDialog_content_top">
                                        <h1 className="mx_HostSignupDialog_text_dark">
                                            {this.config.info.title}
                                        </h1>
                                        {this.config.info.additionalParagraphs &&
                                            <div className="mx_HostSignupDialog_paragraphs">
                                                {this.config.info.additionalParagraphs.map((para, index) => {
                                                    return <p className="mx_HostSignupDialog_text_light" key={index}>
                                                        {para}
                                                    </p>;
                                                })}
                                                {this.config.info.additionalInfoLink &&
                                                    <p><small>
                                                        <a href={this.config.info.additionalInfoLink.href}
                                                            target="_blank" rel="noopener noreferrer"
                                                            title={this.config.info.additionalInfoLink.text}
                                                        >
                                                            {this.config.info.additionalInfoLink.text}
                                                        </a>
                                                    </small></p>
                                                }
                                            </div>
                                        }
                                    </div>
                                    <div className="mx_HostSignupDialog_buttons">
                                        <AccessibleButton
                                            onClick={this.closeDialog}
                                            aria-label={this.config.info.cancelText}
                                        >
                                            <button>
                                                {this.config.info.cancelText}
                                            </button>
                                        </AccessibleButton>
                                        <AccessibleButton
                                            onClick={this.onStartClick}
                                            aria-label={this.config.info.continueText}
                                        >
                                            <button className="mx_Dialog_primary">
                                                {this.config.info.continueText}
                                            </button>
                                        </AccessibleButton>
                                    </div>
                                    {this.config.info.footer &&
                                        <div className="mx_HostSignupDialog_text_light">
                                            <small>
                                                <p className="mx_HostSignupDialog_footer">
                                                    {this.config.info.footer.image &&
                                                        <img
                                                            alt={this.config.info.footer.image.alt}
                                                            height={this.config.info.footer.image.height}
                                                            src={this.config.info.footer.image.src}
                                                            width={this.config.info.footer.image.width}
                                                        />
                                                    }
                                                    {this.config.info.footer.text}
                                                </p>
                                            </small>
                                        </div>
                                    }
                                </div>
                            }
                            {this.state.error &&
                                <div>
                                    {this.state.error}
                                </div>
                            }
                        </div>
                        {!this.state.minimized &&
                            <div className="mx_Dialog_background mx_HostSignupDialog_background" />
                        }
                    </div>
                </PersistedElement>
            </div>
        );
    }
}
