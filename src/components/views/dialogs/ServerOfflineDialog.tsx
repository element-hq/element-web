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

import * as React from 'react';
import BaseDialog from './BaseDialog';
import { _t } from '../../../languageHandler';
import { EchoStore } from "../../../stores/local-echo/EchoStore";
import { formatTime } from "../../../DateUtils";
import SettingsStore from "../../../settings/SettingsStore";
import { RoomEchoContext } from "../../../stores/local-echo/RoomEchoContext";
import RoomAvatar from "../avatars/RoomAvatar";
import { TransactionStatus } from "../../../stores/local-echo/EchoTransaction";
import Spinner from "../elements/Spinner";
import AccessibleButton from "../elements/AccessibleButton";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    onFinished: (bool) => void;
}

export default class ServerOfflineDialog extends React.PureComponent<IProps> {
    public componentDidMount() {
        EchoStore.instance.on(UPDATE_EVENT, this.onEchosUpdated);
    }

    public componentWillUnmount() {
        EchoStore.instance.off(UPDATE_EVENT, this.onEchosUpdated);
    }

    private onEchosUpdated = () => {
        this.forceUpdate(); // no state to worry about
    };

    private renderTimeline(): React.ReactElement[] {
        return EchoStore.instance.contexts.map((c, i) => {
            if (!c.firstFailedTime) return null; // not useful
            if (!(c instanceof RoomEchoContext)) throw new Error("Cannot render unknown context: " + c);
            const header = (
                <div className="mx_ServerOfflineDialog_content_context_timeline_header">
                    <RoomAvatar width={24} height={24} room={c.room} />
                    <span>{c.room.name}</span>
                </div>
            );
            const entries = c.transactions
                .filter(t => t.status === TransactionStatus.DoneError || t.didPreviouslyFail)
                .map((t, j) => {
                    let button = <Spinner w={19} h={19} />;
                    if (t.status === TransactionStatus.DoneError) {
                        button = (
                            <AccessibleButton kind="link" onClick={() => t.run()}>{_t("Resend")}</AccessibleButton>
                        );
                    }
                    return (
                        <div className="mx_ServerOfflineDialog_content_context_txn" key={`txn-${j}`}>
                            <span className="mx_ServerOfflineDialog_content_context_txn_desc">
                                {t.auditName}
                            </span>
                            {button}
                        </div>
                    );
                });
            return (
                <div className="mx_ServerOfflineDialog_content_context" key={`context-${i}`}>
                    <div className="mx_ServerOfflineDialog_content_context_timestamp">
                        {formatTime(c.firstFailedTime, SettingsStore.getValue("showTwelveHourTimestamps"))}
                    </div>
                    <div className="mx_ServerOfflineDialog_content_context_timeline">
                        {header}
                        {entries}
                    </div>
                </div>
            )
        });
    }

    public render() {
        let timeline = this.renderTimeline().filter(c => !!c); // remove nulls for next check
        if (timeline.length === 0) {
            timeline = [<div key={1}>{_t("You're all caught up.")}</div>];
        }

        const serverName = MatrixClientPeg.getHomeserverName();
        return <BaseDialog title={_t("Server isn't responding")}
            className='mx_ServerOfflineDialog'
            contentId='mx_Dialog_content'
            onFinished={this.props.onFinished}
            hasCancel={true}
        >
            <div className="mx_ServerOfflineDialog_content">
                <p>{_t(
                    "Your server isn't responding to some of your requests. " +
                    "Below are some of the most likely reasons.",
                )}</p>
                <ul>
                    <li>{_t("The server (%(serverName)s) took too long to respond.", {serverName})}</li>
                    <li>{_t("Your firewall or anti-virus is blocking the request.")}</li>
                    <li>{_t("A browser extension is preventing the request.")}</li>
                    <li>{_t("The server is offline.")}</li>
                    <li>{_t("The server has denied your request.")}</li>
                    <li>{_t("Your area is experiencing difficulties connecting to the internet.")}</li>
                    <li>{_t("A connection error occurred while trying to contact the server.")}</li>
                    <li>{_t("The server is not configured to indicate what the problem is (CORS).")}</li>
                </ul>
                <hr />
                <h2>{_t("Recent changes that have not yet been received")}</h2>
                {timeline}
            </div>
        </BaseDialog>;
    }
}
