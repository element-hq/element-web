/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../languageHandler";
import SdkConfig from "../../../../SdkConfig";
import SettingsStore from "../../../../settings/SettingsStore";
import Modal from "../../../../Modal";
import { formatBytes, formatCountLong } from "../../../../utils/FormattingUtils";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";
import { SettingLevel } from "../../../../settings/SettingLevel";
import Field from "../../../../components/views/elements/Field";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import DialogButtons from "../../../../components/views/elements/DialogButtons";
import { type IIndexStats } from "../../../../indexing/BaseEventIndexManager";

interface IProps {
    onFinished(): void;
}

interface IState {
    /** Size of the event index, in bytes. */
    eventIndexSize: number;

    /** Number of events currently indexed in the event index. */
    eventCount: number;

    /** Joined encrypted rooms still being back-filled (have a crawler checkpoint). */
    indexing: number;

    /** Joined encrypted rooms that are fully indexed (no checkpoint left). */
    indexed: number;

    /** Joined encrypted rooms the crawler has given up on after a permanent error. */
    errored: number;

    /** Room currently being crawled by the EventIndex. */
    currentRoom: string | null;

    /** Time to sleep between crawlwer passes, in milliseconds. */
    crawlerSleepTime: number;
}

/*
 * Allows the user to introspect the event index state and disable it.
 */
export default class ManageEventIndexDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            eventIndexSize: 0,
            eventCount: 0,
            indexing: 0,
            indexed: 0,
            errored: 0,
            currentRoom: null,
            crawlerSleepTime: SettingsStore.getValueAt(SettingLevel.DEVICE, "crawlerSleepTime"),
        };
    }

    public updateCurrentRoom = async (room: Room | null): Promise<void> => {
        const eventIndex = EventIndexPeg.get();
        if (!eventIndex) return;
        let stats: IIndexStats | undefined;

        try {
            stats = await eventIndex.getStats();
        } catch {
            // This call may fail if sporadically, not a huge issue as we will
            // try later again and probably succeed.
            return;
        }

        let currentRoom: string | null = null;

        if (room) currentRoom = room.name;

        // Cheap, synchronous in-memory breakdown - no Seshat IPC, so it's safe to
        // compute on every refresh.
        const { indexing, indexed, errored } = eventIndex.getIndexingStatus();

        this.setState({
            eventIndexSize: stats?.size ?? 0,
            eventCount: stats?.eventCount ?? 0,
            indexing,
            indexed,
            errored,
            currentRoom: currentRoom,
        });
    };

    public componentWillUnmount(): void {
        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.removeListener("changedCheckpoint", this.updateCurrentRoom);
        }
    }

    public async componentDidMount(): Promise<void> {
        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom);

            const room = eventIndex.currentRoom();
            await this.updateCurrentRoom(room);
        }
    }

    private onDisable = async (): Promise<void> => {
        const DisableEventIndexDialog = (await import("./DisableEventIndexDialog")).default;
        Modal.createDialog(DisableEventIndexDialog, undefined, undefined, /* priority = */ false, /* static = */ true);
    };

    private onCrawlerSleepTimeChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ crawlerSleepTime: parseInt(e.target.value, 10) });
        SettingsStore.setValue("crawlerSleepTime", null, SettingLevel.DEVICE, e.target.valueAsNumber);
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        let crawlerState;
        if (this.state.currentRoom === null) {
            crawlerState = _t("settings|security|message_search_indexing_idle");
        } else {
            crawlerState = _t("settings|security|message_search_indexing", { currentRoom: this.state.currentRoom });
        }

        const eventIndexingSettings = (
            <div>
                {_t("settings|security|message_search_intro", {
                    brand,
                })}
                <div className="mx_SettingsTab_subsectionText">
                    {crawlerState}
                    <br />
                    {_t("settings|security|message_search_space_used")} {formatBytes(this.state.eventIndexSize, 0)}
                    <br />
                    {_t("settings|security|message_search_indexed_messages")} {formatCountLong(this.state.eventCount)}
                    <br />
                    {_t("settings|security|message_search_indexed_rooms")}{" "}
                    {this.state.errored > 0
                        ? _t("settings|security|message_search_room_progress_errored", {
                              indexed: formatCountLong(this.state.indexed),
                              indexing: formatCountLong(this.state.indexing),
                              errored: formatCountLong(this.state.errored),
                          })
                        : _t("settings|security|message_search_room_progress", {
                              indexed: formatCountLong(this.state.indexed),
                              indexing: formatCountLong(this.state.indexing),
                          })}
                    <br />
                    <Field
                        label={_t("settings|security|message_search_sleep_time")}
                        type="number"
                        value={this.state.crawlerSleepTime.toString()}
                        onChange={this.onCrawlerSleepTimeChange}
                    />
                </div>
            </div>
        );

        return (
            <BaseDialog
                className="mx_ManageEventIndexDialog"
                onFinished={this.props.onFinished}
                title={_t("settings|security|message_search_section")}
            >
                {eventIndexingSettings}
                <DialogButtons
                    primaryButton={_t("action|done")}
                    onPrimaryButtonClick={this.props.onFinished}
                    primaryButtonClass="primary"
                    cancelButton={_t("action|disable")}
                    onCancel={this.onDisable}
                    cancelButtonClass="danger"
                />
            </BaseDialog>
        );
    }
}
