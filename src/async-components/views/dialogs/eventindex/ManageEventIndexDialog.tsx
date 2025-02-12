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
    eventIndexSize: number;
    eventCount: number;
    crawlingRoomsCount: number;
    roomCount: number;
    currentRoom: string | null;
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
            crawlingRoomsCount: 0,
            roomCount: 0,
            currentRoom: null,
            crawlerSleepTime: SettingsStore.getValueAt(SettingLevel.DEVICE, "crawlerSleepTime"),
        };
    }

    public updateCurrentRoom = async (room: Room): Promise<void> => {
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
        const roomStats = eventIndex.crawlingRooms();
        const crawlingRoomsCount = roomStats.crawlingRooms.size;
        const roomCount = roomStats.totalRooms.size;

        this.setState({
            eventIndexSize: stats?.size ?? 0,
            eventCount: stats?.eventCount ?? 0,
            crawlingRoomsCount: crawlingRoomsCount,
            roomCount: roomCount,
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
        let eventIndexSize = 0;
        let crawlingRoomsCount = 0;
        let roomCount = 0;
        let eventCount = 0;
        let currentRoom: string | null = null;

        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom);

            try {
                const stats = await eventIndex.getStats();
                if (stats) {
                    eventIndexSize = stats.size;
                    eventCount = stats.eventCount;
                }
            } catch {
                // This call may fail if sporadically, not a huge issue as we
                // will try later again in the updateCurrentRoom call and
                // probably succeed.
            }

            const roomStats = eventIndex.crawlingRooms();
            crawlingRoomsCount = roomStats.crawlingRooms.size;
            roomCount = roomStats.totalRooms.size;

            const room = eventIndex.currentRoom();
            if (room) currentRoom = room.name;
        }

        this.setState({
            eventIndexSize,
            eventCount,
            crawlingRoomsCount,
            roomCount,
            currentRoom,
        });
    }

    private onDisable = async (): Promise<void> => {
        const DisableEventIndexDialog = (await import("./DisableEventIndexDialog")).default;
        Modal.createDialog(DisableEventIndexDialog, undefined, undefined, /* priority = */ false, /* static = */ true);
    };

    private onCrawlerSleepTimeChange = (e: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ crawlerSleepTime: parseInt(e.target.value, 10) });
        SettingsStore.setValue("crawlerSleepTime", null, SettingLevel.DEVICE, e.target.value);
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        let crawlerState;
        if (this.state.currentRoom === null) {
            crawlerState = _t("settings|security|message_search_indexing_idle");
        } else {
            crawlerState = _t("settings|security|message_search_indexing", { currentRoom: this.state.currentRoom });
        }

        const doneRooms = Math.max(0, this.state.roomCount - this.state.crawlingRoomsCount);

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
                    {_t("settings|security|message_search_room_progress", {
                        doneRooms: formatCountLong(doneRooms),
                        totalRooms: formatCountLong(this.state.roomCount),
                    })}{" "}
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
