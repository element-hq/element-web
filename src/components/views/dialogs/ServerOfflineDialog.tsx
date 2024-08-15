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

import React, { ReactNode } from "react";

import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
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
    onFinished(): void;
}

export default class ServerOfflineDialog extends React.PureComponent<IProps> {
    public componentDidMount(): void {
        EchoStore.instance.on(UPDATE_EVENT, this.onEchosUpdated);
    }

    public componentWillUnmount(): void {
        EchoStore.instance.off(UPDATE_EVENT, this.onEchosUpdated);
    }

    private onEchosUpdated = (): void => {
        this.forceUpdate(); // no state to worry about
    };

    private renderTimeline(): ReactNode[] {
        return EchoStore.instance.contexts.map((c, i) => {
            if (!c.firstFailedTime) return null; // not useful
            if (!(c instanceof RoomEchoContext))
                throw new Error("Cannot render unknown context: " + c.constructor.name);
            const header = (
                <div className="mx_ServerOfflineDialog_content_context_timeline_header">
                    <RoomAvatar size="24px" room={c.room} />
                    <span>{c.room.name}</span>
                </div>
            );
            const entries = c.transactions
                .filter((t) => t.status === TransactionStatus.Error || t.didPreviouslyFail)
                .map((t, j) => {
                    let button = <Spinner w={19} h={19} />;
                    if (t.status === TransactionStatus.Error) {
                        button = (
                            <AccessibleButton kind="link" onClick={() => t.run()}>
                                {_t("action|resend")}
                            </AccessibleButton>
                        );
                    }
                    return (
                        <div className="mx_ServerOfflineDialog_content_context_txn" key={`txn-${j}`}>
                            <span className="mx_ServerOfflineDialog_content_context_txn_desc">{t.auditName}</span>
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
            );
        });
    }

    public render(): React.ReactNode {
        let timeline = this.renderTimeline().filter((c) => !!c); // remove nulls for next check
        if (timeline.length === 0) {
            timeline = [<div key={1}>{_t("server_offline|empty_timeline")}</div>];
        }

        const serverName = MatrixClientPeg.safeGet().getDomain();
        return (
            <BaseDialog
                title={_t("server_offline|title")}
                className="mx_ServerOfflineDialog"
                contentId="mx_Dialog_content"
                onFinished={this.props.onFinished}
                hasCancel={true}
            >
                <div className="mx_ServerOfflineDialog_content">
                    <p>{_t("server_offline|description")}</p>
                    <ul>
                        <li>{_t("server_offline|description_1", { serverName })}</li>
                        <li>{_t("server_offline|description_2")}</li>
                        <li>{_t("server_offline|description_3")}</li>
                        <li>{_t("server_offline|description_4")}</li>
                        <li>{_t("server_offline|description_5")}</li>
                        <li>{_t("server_offline|description_6")}</li>
                        <li>{_t("server_offline|description_7")}</li>
                        <li>{_t("server_offline|description_8")}</li>
                    </ul>
                    <hr />
                    <h2>{_t("server_offline|recent_changes_heading")}</h2>
                    {timeline}
                </div>
            </BaseDialog>
        );
    }
}
