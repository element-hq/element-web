/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import EncryptionInfo from "./EncryptionInfo";
import VerificationPanel from "./VerificationPanel";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {ensureDMExists} from "../../../createRoom";
import {UserInfoPane} from "./UserInfo";
import {_t} from "../../../languageHandler";

export default class EncryptionPanel extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        let content;
        const request = this.props.verificationRequest || this.state.verificationRequest;
        const {member} = this.props;
        if (request) {
            content = <VerificationPanel request={request} key={request.channel.transactionId} />;
        } else if (member) {
            content = <EncryptionInfo onStartVerification={this._onStartVerification} member={member} />;
        } else {
            content = <p>Not a member nor request, not sure what to render</p>;
        }

        return (
            <UserInfoPane className="mx_UserInfo_smallAvatar" member={member} onClose={this.props.onClose} e2eStatus="">
                <div className="mx_UserInfo_container">
                    <h3>{_t("Encryption")}</h3>
                    <div>
                        <p>{_t("Messages in this room are end-to-end encrypted.")}</p>
                        <p>{_t("Your messages are secured and only you and the recipient have the unique keys to unlock them.")}</p>
                    </div>
                </div>

                { content }
            </UserInfoPane>
        );
    }

    _onStartVerification = async () => {
        const client = MatrixClientPeg.get();
        const {member} = this.props;
        const roomId = await ensureDMExists(client, member.userId);
        const verificationRequest = await client.requestVerificationDM(member.userId, roomId);
        this.setState({verificationRequest});
    };
}
