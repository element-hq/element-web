/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import BaseDialog from '../../views/dialogs/BaseDialog';
import ElementProConfirmCloseDialog from './ElementProConfirmCloseDialog';
import ElementProDataConfirmDialog from './ElementProDataConfirmDialog';
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";
import {_t} from "../../../languageHandler";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {OwnProfileStore} from "../../../stores/OwnProfileStore";
import {IPostmessage, IPostmessageResponseData, PostmessageAction} from "./ElementProDialogTypes";

interface IProps {
    requestClose(): void;
}

interface IState {
    completed: boolean;
    error: string;
}

export default class ElementProDialog extends React.PureComponent<IProps, IState> {
    private iframeRef: React.RefObject<HTMLIFrameElement> = React.createRef();
    private readonly elementProSetupUrl: string;

    constructor(props: IProps) {
        super(props);

        this.state = {
            completed: false,
            error: null,
        };

        this.elementProSetupUrl = SdkConfig.get().element_pro.url;
    }

    private messageHandler = (message: IPostmessage) => {
        if (!this.elementProSetupUrl.startsWith(message.origin)) {
            return;
        }
        switch (message.data.action) {
            case PostmessageAction.ElementProAccountDetailsRequest:
                Modal.createDialog(
                    ElementProDataConfirmDialog,
                    {
                        onFinished: result => {
                            if (result) {
                                return this.sendAccountDetails();
                            }
                        },
                    },
                );
                break;
            case PostmessageAction.SetupComplete:
                // Set as completed but let the user close the modal themselves
                // so they have time to finish reading any information
                this.setState({
                    completed: true,
                });
                break;
            case PostmessageAction.CloseDialog:
                this.onFinished(true);
                break;
        }
    }

    private onFinished = (result: boolean) => {
        if (result || this.state.completed) {
            // We're done, close
            this.props.requestClose();
        } else {
            Modal.createDialog(
                ElementProConfirmCloseDialog,
                {
                    onFinished: result => {
                        if (result) {
                            this.props.requestClose();
                        }
                    },
                },
            );
        }
    }

    private sendMessage = (message: IPostmessageResponseData) => {
        this.iframeRef.current.contentWindow.postMessage(message, this.elementProSetupUrl);
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
            action: PostmessageAction.ElementProAccountDetails,
            account: {
                accessToken: await MatrixClientPeg.get().getAccessToken(),
                name: OwnProfileStore.instance.displayName,
                openIdToken: openIdToken.access_token,
                serverName: await MatrixClientPeg.get().getDomain(),
                userLocalpart: await MatrixClientPeg.get().getUserIdLocalpart(),
            },
        });
    }

    public componentDidMount() {
        window.addEventListener("message", this.messageHandler);
    }

    public componentWillUnmount() {
        window.removeEventListener("message", this.messageHandler);
    }

    public render(): React.ReactNode {
        return (
            <BaseDialog
                className="mx_ElementProBaseDialog"
                onFinished={this.onFinished}
                title={_t("Set up your own personal Element host")}
                hasCancel={true}
                fixedWidth={false}
            >
                <div className="mx_ElementProDialog_container">
                    <iframe
                        src={this.elementProSetupUrl}
                        ref={this.iframeRef}
                        sandbox="allow-forms allow-scripts allow-same-origin"
                    />
                    {this.state.error &&
                        <div>
                            {this.state.error}
                        </div>
                    }
                </div>
            </BaseDialog>
        );
    }
}
