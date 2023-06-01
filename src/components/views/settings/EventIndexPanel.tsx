/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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

import React from "react";

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

export default class EventIndexPanel extends React.Component<{}, IState> {
    public constructor(props: {}) {
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
        Modal.createDialogAsync(
            // @ts-ignore: TS doesn't seem to like the type of this now that it
            // has also been converted to TS as well, but I can't figure out why...
            import("../../../async-components/views/dialogs/eventindex/ManageEventIndexDialog"),
            {
                onFinished: () => {},
            },
            null,
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
                        {_t(
                            "Securely cache encrypted messages locally for them " +
                                "to appear in search results, using %(size)s to store messages from %(rooms)s rooms.",
                            {
                                size: formatBytes(this.state.eventIndexSize, 0),
                                // This drives the singular / plural string
                                // selection for "room" / "rooms" only.
                                count: this.state.roomCount,
                                rooms: formatCountLong(this.state.roomCount),
                            },
                        )}
                    </SettingsSubsectionText>
                    <AccessibleButton kind="primary" onClick={this.onManage}>
                        {_t("Manage")}
                    </AccessibleButton>
                </>
            );
        } else if (!this.state.eventIndexingEnabled && EventIndexPeg.supportIsInstalled()) {
            eventIndexingSettings = (
                <>
                    <SettingsSubsectionText>
                        {_t("Securely cache encrypted messages locally for them to appear in search results.")}
                    </SettingsSubsectionText>
                    <div>
                        <AccessibleButton kind="primary" disabled={this.state.enabling} onClick={this.onEnable}>
                            {_t("Enable")}
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
                        "%(brand)s is missing some components required for securely " +
                            "caching encrypted messages locally. If you'd like to " +
                            "experiment with this feature, build a custom %(brand)s Desktop " +
                            "with <nativeLink>search components added</nativeLink>.",
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
                        "%(brand)s can't securely cache encrypted messages locally " +
                            "while running in a web browser. Use <desktopLink>%(brand)s Desktop</desktopLink> " +
                            "for encrypted messages to appear in search results.",
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
                        {this.state.enabling ? <InlineSpinner /> : _t("Message search initialisation failed")}
                    </SettingsSubsectionText>
                    {EventIndexPeg.error && (
                        <SettingsSubsectionText>
                            <details>
                                <summary>{_t("Advanced")}</summary>
                                <code>{EventIndexPeg.error.message}</code>
                                <p>
                                    <AccessibleButton key="delete" kind="danger" onClick={this.confirmEventStoreReset}>
                                        {_t("Reset")}
                                    </AccessibleButton>
                                </p>
                            </details>
                        </SettingsSubsectionText>
                    )}
                </>
            );
        }

        return eventIndexingSettings;
    }
}
