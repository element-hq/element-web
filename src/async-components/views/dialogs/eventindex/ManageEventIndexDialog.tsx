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

    /** Number of rooms currently mentioned in the event index. */
    eventIndexRoomCount: number;

    /** Number of rooms awaiting crawling by the EventIndex. */
    crawlingRoomsCount: number;

    /** Number of encrypted rooms known by the MatrixClient. */
    roomCount: number;

    /** Room currently being crawled by the EventIndex. */
    currentRoom: string | null;

    /** Time to sleep between crawlwer passes, in milliseconds. */
    crawlerSleepTime: number;

    /** Tokenizer mode for search indexing. */
    tokenizerMode: string;

    /** Initial tokenizer mode when dialog was opened. */
    initialTokenizerMode: string;
}

/*
 * Allows the user to introspect the event index state and disable it.
 */
export default class ManageEventIndexDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        const initialTokenizerMode = SettingsStore.getValueAt(SettingLevel.DEVICE, "tokenizerMode");
        this.state = {
            eventIndexSize: 0,
            eventCount: 0,
            eventIndexRoomCount: 0,
            crawlingRoomsCount: 0,
            roomCount: 0,
            currentRoom: null,
            crawlerSleepTime: SettingsStore.getValueAt(SettingLevel.DEVICE, "crawlerSleepTime"),
            tokenizerMode: initialTokenizerMode,
            initialTokenizerMode: initialTokenizerMode,
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
        const roomStats = eventIndex.crawlingRooms();
        const crawlingRoomsCount = roomStats.crawlingRooms.size;
        const roomCount = roomStats.totalRooms.size;

        this.setState({
            eventIndexSize: stats?.size ?? 0,
            eventCount: stats?.eventCount ?? 0,
            eventIndexRoomCount: stats?.roomCount ?? 0,
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
        SettingsStore.setValue("crawlerSleepTime", null, SettingLevel.DEVICE, e.target.value);
    };

    private onTokenizerModeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        this.setState({ tokenizerMode: e.target.value });
        // Don't save to settings yet - wait for Done button
    };

    private onDone = async (): Promise<void> => {
        // Check if tokenizer mode has changed
        if (this.state.tokenizerMode !== this.state.initialTokenizerMode) {
            // Show confirmation dialog
            const ConfirmTokenizerChangeDialog = (await import("./ConfirmTokenizerChangeDialog")).default;
            Modal.createDialog(
                ConfirmTokenizerChangeDialog,
                {
                    onFinished: async (confirmed?: boolean) => {
                        if (confirmed) {
                            // Save the tokenizer mode setting
                            SettingsStore.setValue(
                                "tokenizerMode",
                                null,
                                SettingLevel.DEVICE,
                                this.state.tokenizerMode,
                            );
                        } else {
                            // User cancelled - revert tokenizer mode to initial value
                            this.setState({ tokenizerMode: this.state.initialTokenizerMode });
                            SettingsStore.setValue(
                                "tokenizerMode",
                                null,
                                SettingLevel.DEVICE,
                                this.state.initialTokenizerMode,
                            );
                        }
                        this.props.onFinished();
                    },
                },
                undefined,
                /* priority = */ false,
                /* static = */ true,
            );
        } else {
            // No change, just close the dialog
            this.props.onFinished();
        }
    };

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        let crawlerState;
        if (this.state.currentRoom === null) {
            crawlerState = _t("settings|security|message_search_indexing_idle");
        } else {
            crawlerState = _t("settings|security|message_search_indexing", { currentRoom: this.state.currentRoom });
        }

        const doneRooms = Math.max(0, this.state.eventIndexRoomCount - this.state.crawlingRoomsCount);

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
                    {_t("settings|security|message_search_pending_rooms", {
                        pendingRooms: formatCountLong(this.state.crawlingRoomsCount),
                    })}
                    <br />
                    <Field
                        label={_t("settings|security|message_search_sleep_time")}
                        type="number"
                        value={this.state.crawlerSleepTime.toString()}
                        onChange={this.onCrawlerSleepTimeChange}
                    />
                    <Field
                        element="select"
                        label={_t("settings|security|tokenizer_mode")}
                        value={this.state.tokenizerMode}
                        onChange={this.onTokenizerModeChange}
                    >
                        <option value="ngram">{_t("settings|security|tokenizer_mode_ngram")}</option>
                        <option value="language">{_t("settings|security|tokenizer_mode_language")}</option>
                    </Field>
                    <div className="mx_SettingsTab_subsectionText">
                        {_t("settings|security|tokenizer_mode_description")}
                    </div>
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
                    onPrimaryButtonClick={this.onDone}
                    primaryButtonClass="primary"
                    cancelButton={_t("action|disable")}
                    onCancel={this.onDisable}
                    cancelButtonClass="danger"
                />
            </BaseDialog>
        );
    }
}
