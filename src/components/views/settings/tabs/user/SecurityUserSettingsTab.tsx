/*
Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.

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
import { sleep } from "matrix-js-sdk/src/utils";
import { Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership, Membership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import AccessibleButton from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SecureBackupPanel from "../../SecureBackupPanel";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import E2eAdvancedPanel, { isE2eAdvancedPanelPossible } from "../../E2eAdvancedPanel";
import { ActionPayload } from "../../../../../dispatcher/payloads";
import CryptographyPanel from "../../CryptographyPanel";
import SettingsFlag from "../../../elements/SettingsFlag";
import CrossSigningPanel from "../../CrossSigningPanel";
import EventIndexPanel from "../../EventIndexPanel";
import InlineSpinner from "../../../elements/InlineSpinner";
import { PosthogAnalytics } from "../../../../../PosthogAnalytics";
import { showDialog as showAnalyticsLearnMoreDialog } from "../../../dialogs/AnalyticsLearnMoreDialog";
import { privateShouldBeEncrypted } from "../../../../../utils/rooms";
import type { IServerVersions } from "matrix-js-sdk/src/matrix";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";
import { useOwnDevices } from "../../devices/useOwnDevices";

interface IIgnoredUserProps {
    userId: string;
    onUnignored: (userId: string) => void;
    inProgress: boolean;
}

const DehydratedDeviceStatus: React.FC = () => {
    const { dehydratedDeviceId } = useOwnDevices();

    if (dehydratedDeviceId) {
        return (
            <div className="mx_SettingsSubsection_content">
                <div className="mx_SettingsFlag_label">{_t("settings|security|dehydrated_device_enabled")}</div>
                <div className="mx_SettingsSubsection_text">
                    {_t("settings|security|dehydrated_device_description")}
                </div>
            </div>
        );
    } else {
        return null;
    }
};

export class IgnoredUser extends React.Component<IIgnoredUserProps> {
    private onUnignoreClicked = (): void => {
        this.props.onUnignored(this.props.userId);
    };

    public render(): React.ReactNode {
        const id = `mx_SecurityUserSettingsTab_ignoredUser_${this.props.userId}`;
        return (
            <div className="mx_SecurityUserSettingsTab_ignoredUser">
                <AccessibleButton
                    onClick={this.onUnignoreClicked}
                    kind="primary_sm"
                    aria-describedby={id}
                    disabled={this.props.inProgress}
                >
                    {_t("action|unignore")}
                </AccessibleButton>
                <span id={id}>{this.props.userId}</span>
            </div>
        );
    }
}

interface IProps {
    closeSettingsFn: () => void;
}

interface IState {
    ignoredUserIds: string[];
    waitingUnignored: string[];
    managingInvites: boolean;
    invitedRoomIds: Set<string>;
    versions?: IServerVersions;
}

export default class SecurityUserSettingsTab extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        // Get rooms we're invited to
        const invitedRoomIds = new Set(this.getInvitedRooms().map((room) => room.roomId));

        this.state = {
            ignoredUserIds: MatrixClientPeg.safeGet().getIgnoredUsers(),
            waitingUnignored: [],
            managingInvites: false,
            invitedRoomIds,
        };
    }

    private onAction = ({ action }: ActionPayload): void => {
        if (action === "ignore_state_changed") {
            const ignoredUserIds = MatrixClientPeg.safeGet().getIgnoredUsers();
            const newWaitingUnignored = this.state.waitingUnignored.filter((e) => ignoredUserIds.includes(e));
            this.setState({ ignoredUserIds, waitingUnignored: newWaitingUnignored });
        }
    };

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.safeGet().on(RoomEvent.MyMembership, this.onMyMembership);
        MatrixClientPeg.safeGet()
            .getVersions()
            .then((versions) => this.setState({ versions }));
    }

    public componentWillUnmount(): void {
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
        MatrixClientPeg.safeGet().removeListener(RoomEvent.MyMembership, this.onMyMembership);
    }

    private onMyMembership = (room: Room, membership: Membership): void => {
        if (room.isSpaceRoom()) {
            return;
        }

        if (membership === KnownMembership.Invite) {
            this.addInvitedRoom(room);
        } else if (this.state.invitedRoomIds.has(room.roomId)) {
            // The user isn't invited anymore
            this.removeInvitedRoom(room.roomId);
        }
    };

    private addInvitedRoom = (room: Room): void => {
        this.setState(({ invitedRoomIds }) => ({
            invitedRoomIds: new Set(invitedRoomIds).add(room.roomId),
        }));
    };

    private removeInvitedRoom = (roomId: string): void => {
        this.setState(({ invitedRoomIds }) => {
            const newInvitedRoomIds = new Set(invitedRoomIds);
            newInvitedRoomIds.delete(roomId);

            return {
                invitedRoomIds: newInvitedRoomIds,
            };
        });
    };

    private onUserUnignored = async (userId: string): Promise<void> => {
        const { ignoredUserIds, waitingUnignored } = this.state;
        const currentlyIgnoredUserIds = ignoredUserIds.filter((e) => !waitingUnignored.includes(e));

        const index = currentlyIgnoredUserIds.indexOf(userId);
        if (index !== -1) {
            currentlyIgnoredUserIds.splice(index, 1);
            this.setState(({ waitingUnignored }) => ({ waitingUnignored: [...waitingUnignored, userId] }));
            MatrixClientPeg.safeGet().setIgnoredUsers(currentlyIgnoredUserIds);
        }
    };

    private getInvitedRooms = (): Room[] => {
        return MatrixClientPeg.safeGet()
            .getRooms()
            .filter((r) => {
                return r.hasMembershipState(MatrixClientPeg.safeGet().getUserId()!, KnownMembership.Invite);
            });
    };

    private manageInvites = async (accept: boolean): Promise<void> => {
        this.setState({
            managingInvites: true,
        });

        // iterate with a normal for loop in order to retry on action failure
        const invitedRoomIdsValues = Array.from(this.state.invitedRoomIds);

        // Execute all acceptances/rejections sequentially
        const cli = MatrixClientPeg.safeGet();
        const action = accept ? cli.joinRoom.bind(cli) : cli.leave.bind(cli);
        for (let i = 0; i < invitedRoomIdsValues.length; i++) {
            const roomId = invitedRoomIdsValues[i];

            // Accept/reject invite
            await action(roomId).then(
                () => {
                    // No error, update invited rooms button
                    this.removeInvitedRoom(roomId);
                },
                async (e): Promise<void> => {
                    // Action failure
                    if (e.errcode === "M_LIMIT_EXCEEDED") {
                        // Add a delay between each invite change in order to avoid rate
                        // limiting by the server.
                        await sleep(e.retry_after_ms || 2500);

                        // Redo last action
                        i--;
                    } else {
                        // Print out error with joining/leaving room
                        logger.warn(e);
                    }
                },
            );
        }

        this.setState({
            managingInvites: false,
        });
    };

    private onAcceptAllInvitesClicked = (): void => {
        this.manageInvites(true);
    };

    private onRejectAllInvitesClicked = (): void => {
        this.manageInvites(false);
    };

    private renderIgnoredUsers(): JSX.Element {
        const { waitingUnignored, ignoredUserIds } = this.state;

        const userIds = !ignoredUserIds?.length
            ? _t("settings|security|ignore_users_empty")
            : ignoredUserIds.map((u) => {
                  return (
                      <IgnoredUser
                          userId={u}
                          onUnignored={this.onUserUnignored}
                          key={u}
                          inProgress={waitingUnignored.includes(u)}
                      />
                  );
              });

        return (
            <SettingsSubsection heading={_t("settings|security|ignore_users_section")}>
                <SettingsSubsectionText>{userIds}</SettingsSubsectionText>
            </SettingsSubsection>
        );
    }

    private renderManageInvites(): ReactNode {
        const { invitedRoomIds } = this.state;

        if (invitedRoomIds.size === 0) {
            return null;
        }

        return (
            <SettingsSubsection heading={_t("settings|security|bulk_options_section")}>
                <div className="mx_SecurityUserSettingsTab_bulkOptions">
                    <AccessibleButton
                        onClick={this.onAcceptAllInvitesClicked}
                        kind="primary_outline"
                        disabled={this.state.managingInvites}
                    >
                        {_t("settings|security|bulk_options_accept_all_invites", { invitedRooms: invitedRoomIds.size })}
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={this.onRejectAllInvitesClicked}
                        kind="danger_outline"
                        disabled={this.state.managingInvites}
                    >
                        {_t("settings|security|bulk_options_reject_all_invites", { invitedRooms: invitedRoomIds.size })}
                    </AccessibleButton>
                    {this.state.managingInvites ? <InlineSpinner /> : <div />}
                </div>
            </SettingsSubsection>
        );
    }

    public render(): React.ReactNode {
        const secureBackup = (
            <SettingsSubsection heading={_t("common|secure_backup")}>
                <SecureBackupPanel />
                <DehydratedDeviceStatus />
            </SettingsSubsection>
        );

        const eventIndex = (
            <SettingsSubsection heading={_t("settings|security|message_search_section")}>
                <EventIndexPanel />
            </SettingsSubsection>
        );

        // XXX: There's no such panel in the current cross-signing designs, but
        // it's useful to have for testing the feature. If there's no interest
        // in having advanced details here once all flows are implemented, we
        // can remove this.
        const crossSigning = (
            <SettingsSubsection heading={_t("common|cross_signing")}>
                <CrossSigningPanel />
            </SettingsSubsection>
        );

        let warning;
        if (!privateShouldBeEncrypted(MatrixClientPeg.safeGet())) {
            warning = (
                <div className="mx_SecurityUserSettingsTab_warning">
                    {_t("settings|security|e2ee_default_disabled_warning")}
                </div>
            );
        }

        let privacySection;
        if (PosthogAnalytics.instance.isEnabled()) {
            const onClickAnalyticsLearnMore = (): void => {
                showAnalyticsLearnMoreDialog({
                    primaryButton: _t("action|ok"),
                    hasCancel: false,
                });
            };
            privacySection = (
                <SettingsSection heading={_t("common|privacy")}>
                    <SettingsSubsection
                        heading={_t("common|analytics")}
                        description={_t("settings|security|analytics_description")}
                    >
                        <AccessibleButton kind="link" onClick={onClickAnalyticsLearnMore}>
                            {_t("action|learn_more")}
                        </AccessibleButton>
                        {PosthogAnalytics.instance.isEnabled() && (
                            <SettingsFlag name="pseudonymousAnalyticsOptIn" level={SettingLevel.ACCOUNT} />
                        )}
                    </SettingsSubsection>
                    <SettingsSubsection heading={_t("settings|sessions|title")}>
                        <SettingsFlag name="deviceClientInformationOptIn" level={SettingLevel.ACCOUNT} />
                    </SettingsSubsection>
                </SettingsSection>
            );
        }

        let advancedSection;
        if (SettingsStore.getValue(UIFeature.AdvancedSettings)) {
            const ignoreUsersPanel = this.renderIgnoredUsers();
            const invitesPanel = this.renderManageInvites();
            const e2ePanel = isE2eAdvancedPanelPossible() ? <E2eAdvancedPanel /> : null;
            // only show the section if there's something to show
            if (ignoreUsersPanel || invitesPanel || e2ePanel) {
                advancedSection = (
                    <SettingsSection heading={_t("common|advanced")}>
                        {ignoreUsersPanel}
                        {invitesPanel}
                        {e2ePanel}
                    </SettingsSection>
                );
            }
        }

        return (
            <SettingsTab>
                {warning}
                <SettingsSection heading={_t("settings|security|encryption_section")}>
                    {secureBackup}
                    {eventIndex}
                    {crossSigning}
                    <CryptographyPanel />
                </SettingsSection>
                {privacySection}
                {advancedSection}
            </SettingsTab>
        );
    }
}
