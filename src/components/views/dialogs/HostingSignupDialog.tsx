/*
Copyright 2020 Element

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
import * as sdk from '../../../index';
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";
import {MatrixClientPeg} from "../../../MatrixClientPeg";

interface IProps {
    requestClose(): void,
}

interface IState {
    error: string,
}

export default class HostingSignupDialog extends React.PureComponent<IProps, IState> {
    iframeRef;
    hostingSignupUrl: string;

    constructor(props: IProps) {
        super(props);

        this.state = {
            error: null,
        };

        this.iframeRef = React.createRef();
        this.hostingSignupUrl = SdkConfig.get().hosting_signup.url;
    }

    private messageHandler = (message) => {
        if (!this.hostingSignupUrl.startsWith(message.origin)) {
            return;
        }

        switch (message.data.action) {
            case 'access_token_credential_request':
                this.sendAccessToken();
                break;
            case 'openid_credentials_request':
                // noinspection JSIgnoredPromiseFromCall
                this.fetchOpenIDToken();
                break;
            case 'setup_complete':
                this.onFinished(true);
                break;
        }
    }

    private onFinished = (result: boolean) => {
        if (result) {
            // We're done, close
            this.props.requestClose();
        } else {
            const ConfirmDialog = sdk.getComponent('views.dialogs.ConfirmCloseHostingSignupDialog');
            Modal.createDialog(
                ConfirmDialog,
                {
                    onFinished: result => {
                        if (result) {
                            // TODO call an API endpoint to clean up?
                            this.props.requestClose();
                        }
                    },
                },
            )
        }
    }

    private sendMessage = (message) => {
        this.iframeRef.contentWindow.postMessage(
            message,
            this.hostingSignupUrl,
        )
    }

    private async fetchOpenIDToken() {
        const token = await MatrixClientPeg.get().getOpenIdToken();
        if (token && token.access_token) {
            this.sendMessage({
                action: 'openid_credentials',
                tokenData: token,
            });
        } else {
            this.setState({
                error: "Failed to connect to your homeserver. Please close this dialog and try again.",
            });
        }
    }

    private sendAccessToken() {
        this.sendMessage({
            action: 'access_token_credential',
            token: MatrixClientPeg.get().getAccessToken(),
        });
    }

    public componentDidMount() {
        window.addEventListener("message", this.messageHandler);
    }

    public componentWillUnmount() {
        window.removeEventListener("message", this.messageHandler);
    }

    public render(): React.ReactNode {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog
                className="mx_HostingSignupBaseDialog"
                onFinished={this.onFinished}
                title="Set up your own personal Element host"
                hasCancel={true}
            >
                <div className="mx_HostingSignupDialog_container">
                    <iframe
                        src={this.hostingSignupUrl}
                        ref={ref => this.iframeRef = ref}
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
