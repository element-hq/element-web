/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { lazy } from "react";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import { formatBytes, formatCountLong } from "../../../utils/FormattingUtils";
import EventIndexPeg from "../../../indexing/EventIndexPeg";
import { SettingLevel } from "../../../settings/SettingLevel";
import SeshatResetDialog from "../dialogs/SeshatResetDialog";
import InlineSpinner from "../elements/InlineSpinner";
import ExternalLink from "../elements/ExternalLink";
import { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface IState {
    enabling: boolean;
    eventIndexSize: number;
    roomCount: number;
    eventIndexingEnabled: boolean;
}

export default class EventIndexPanel extends React.Component<EmptyObject, IState> {
    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            enabling: false,
            eventIndexSize: 0,
            roomCount: 0,
            eventIndexingEnabled: SettingsStore.getValueAt(SettingLevel.DEVICE, "enableEventIndexing"),
        };
    }

    public updateCurrentRoom = async (): Promise<void> => {
        const eventIndex = EventIndexPeg.get();
        const stats = await eventIndex?.getStats().catch(() => {});
        // This call may fail if sporadically, not a huge issue as we will try later again and probably succeed.
        if (!stats) return;

        this.setState({
            eventIndexSize: stats.size,
            roomCount: stats.roomCount,
        });
    };

    public componentWillUnmount(): void {
        const eventIndex = EventIndexPeg.get();

        if (eventIndex !== null) {
            eventIndex.removeListener("changedCheckpoint", this.updateCurrentRoom);
        }
    }

    public componentDidMount(): void {
        this.updateState();
    }

    public async updateState(): Promise<void> {
        const eventIndex = EventIndexPeg.get();
        const eventIndexingEnabled = SettingsStore.getValueAt(SettingLevel.DEVICE, "enableEventIndexing");
        const enabling = false;

        let eventIndexSize = 0;
        let roomCount = 0;

        if (eventIndex !== null) {
            eventIndex.on("changedCheckpoint", this.updateCurrentRoom);

            const stats = await eventIndex.getStats().catch(() => {});
            // This call may fail if sporadically, not a huge issue as we
            // will try later again in the updateCurrentRoom call and
            // probably succeed.
            if (stats) {
                eventIndexSize = stats.size;
                roomCount = stats.roomCount;
            }
        }

        this.setState({
            enabling,
            eventIndexSize,
            roomCount,
            eventIndexingEnabled,
        });
    }

    private onManage = async (): Promise<void> => {
        Modal.createDialog(
            lazy(() => import("../../../async-components/views/dialogs/eventindex/ManageEventIndexDialog")),
            {
                onFinished: () => {},
            },
            undefined,
            /* priority = */ false,
            /* static = */ true,
        );
    };

    private onEnable = async (): Promise<void> => {
        this.setState({
            enabling: true,
        });

        await EventIndexPeg.initEventIndex();
        await EventIndexPeg.get()?.addInitialCheckpoints();
        EventIndexPeg.get()?.startCrawler();
        await SettingsStore.setValue("enableEventIndexing", null, SettingLevel.DEVICE, true);
        await this.updateState();
    };

    private confirmEventStoreReset = (): void => {
        const { close } = Modal.createDialog(SeshatResetDialog, {
            onFinished: async (success): Promise<void> => {
                if (success) {
                    await SettingsStore.setValue("enableEventIndexing", null, SettingLevel.DEVICE, false);
                    await EventIndexPeg.deleteEventIndex();
                    await this.onEnable();
                    close();
                }
            },
        });
    };

    public render(): React.ReactNode {
        let eventIndexingSettings: JSX.Element | undefined;
        const brand = SdkConfig.get().brand;

        if (EventIndexPeg.get() !== null) {
            eventIndexingSettings = (
                <>
                    <SettingsSubsectionText>
                        {_t("settings|security|message_search_enabled", {
                            size: formatBytes(this.state.eventIndexSize, 0),
                            // This drives the singular / plural string
                            // selection for "room" / "rooms" only.
                            count: this.state.roomCount,
                            rooms: formatCountLong(this.state.roomCount),
                        })}
                    </SettingsSubsectionText>
                    <AccessibleButton kind="primary" onClick={this.onManage}>
                        {_t("action|manage")}
                    </AccessibleButton>
                </>
            );
        } else if (!this.state.eventIndexingEnabled && EventIndexPeg.supportIsInstalled()) {
            eventIndexingSettings = (
                <>
                    <SettingsSubsectionText>{_t("settings|security|message_search_disabled")}</SettingsSubsectionText>
                    <div>
                        <AccessibleButton kind="primary" disabled={this.state.enabling} onClick={this.onEnable}>
                            {_t("action|enable")}
                        </AccessibleButton>
                        {this.state.enabling ? <InlineSpinner /> : <div />}
                    </div>
                </>
            );
        } else if (EventIndexPeg.platformHasSupport() && !EventIndexPeg.supportIsInstalled()) {
            const nativeLink =
                "https://github.com/vector-im/element-desktop/blob/develop/" +
                "docs/native-node-modules.md#" +
                "adding-seshat-for-search-in-e2e-encrypted-rooms";

            eventIndexingSettings = (
                <SettingsSubsectionText>
                    {_t(
                        "settings|security|message_search_unsupported",
                        {
                            brand,
                        },
                        {
                            nativeLink: (sub) => (
                                <ExternalLink href={nativeLink} target="_blank" rel="noreferrer noopener">
                                    {sub}
                                </ExternalLink>
                            ),
                        },
                    )}
                </SettingsSubsectionText>
            );
        } else if (!EventIndexPeg.platformHasSupport()) {
            eventIndexingSettings = (
                <SettingsSubsectionText>
                    {_t(
                        "settings|security|message_search_unsupported_web",
                        {
                            brand,
                        },
                        {
                            desktopLink: (sub) => (
                                <ExternalLink
                                    href="https://element.io/get-started"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                >
                                    {sub}
                                </ExternalLink>
                            ),
                        },
                    )}
                </SettingsSubsectionText>
            );
        } else {
            eventIndexingSettings = (
                <>
                    <SettingsSubsectionText>
                        {this.state.enabling ? <InlineSpinner /> : _t("settings|security|message_search_failed")}
                    </SettingsSubsectionText>
                    {EventIndexPeg.error ? (
                        <SettingsSubsectionText>
                            <details>
                                <summary>{_t("common|advanced")}</summary>
                                <code>
                                    {EventIndexPeg.error instanceof Error
                                        ? EventIndexPeg.error.message
                                        : _t("error|unknown")}
                                </code>
                                <p>
                                    <AccessibleButton key="delete" kind="danger" onClick={this.confirmEventStoreReset}>
                                        {_t("action|reset")}
                                    </AccessibleButton>
                                </p>
                            </details>
                        </SettingsSubsectionText>
                    ) : undefined}
                </>
            );
        }

        return eventIndexingSettings;
    }
}
