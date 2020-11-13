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
import SdkConfig from "../../SdkConfig";
import {MatrixClientPeg} from "../../MatrixClientPeg";

interface IProps {}

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
            case 'openid_credentials_request':
                // noinspection JSIgnoredPromiseFromCall
                this.fetchOpenIDToken();
                break;
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

    public componentDidMount() {
        window.addEventListener("message", this.messageHandler);
    }

    public componentWillUnmount() {
        window.removeEventListener("message", this.messageHandler);
    }

    public render(): React.ReactNode {
        return (
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
        );
    }
}
