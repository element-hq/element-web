/*
Copyright 2019 New Vector Ltd
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

import React from 'react';
import { sleep } from "matrix-js-sdk/src/utils";

import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import AccessibleButton from "../../../elements/AccessibleButton";
import Analytics from "../../../../../Analytics";
import dis from "../../../../../dispatcher/dispatcher";
import { privateShouldBeEncrypted } from "../../../../../createRoom";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SecureBackupPanel from "../../SecureBackupPanel";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import E2eAdvancedPanel, { isE2eAdvancedPanelPossible } from "../../E2eAdvancedPanel";
import CountlyAnalytics from "../../../../../CountlyAnalytics";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import { PosthogAnalytics } from "../../../../../PosthogAnalytics";
import { ActionPayload } from "../../../../../dispatcher/payloads";
import { Room } from "matrix-js-sdk/src/models/room";
import CryptographyPanel from "../../CryptographyPanel";
import DevicesPanel from "../../DevicesPanel";
import SettingsFlag from "../../../elements/SettingsFlag";
import CrossSigningPanel from "../../CrossSigningPanel";
import EventIndexPanel from "../../EventIndexPanel";
import InlineSpinner from "../../../elements/InlineSpinner";

import { logger } from "matrix-js-sdk/src/logger";

interface IIgnoredUserProps {
    userId: string;
    onUnignored: (userId: string) => void;
    inProgress: boolean;
}

export class IgnoredUser extends React.Component<IIgnoredUserProps> {
    private onUnignoreClicked = (): void => {
        this.props.onUnignored(this.props.userId);
    };

    public render(): JSX.Element {
        const id = `mx_SecurityUserSettingsTab_ignoredUser_${this.props.userId}`;
        return (
            <div className='mx_SecurityUserSettingsTab_ignoredUser'>
                <AccessibleButton onClick={this.onUnignoreClicked} kind='primary_sm' aria-describedby={id} disabled={this.props.inProgress}>
                    { _t('Unignore') }
                </AccessibleButton>
                <span id={id}>{ this.props.userId }</span>
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
    invitedRoomAmt: number;
}

@replaceableComponent("views.settings.tabs.user.SecurityUserSettingsTab")
export default class SecurityUserSettingsTab extends React.Component<IProps, IState> {
    private dispatcherRef: string;

    constructor(props: IProps) {
        super(props);

        // Get number of rooms we're invited to
        const invitedRooms = this.getInvitedRooms();

        this.state = {
            ignoredUserIds: MatrixClientPeg.get().getIgnoredUsers(),
            waitingUnignored: [],
            managingInvites: false,
            invitedRoomAmt: invitedRooms.length,
        };
    }

    private onAction = ({ action }: ActionPayload)=> {
        if (action === "ignore_state_changed") {
            const ignoredUserIds = MatrixClientPeg.get().getIgnoredUsers();
            const newWaitingUnignored = this.state.waitingUnignored.filter(e=> ignoredUserIds.includes(e));
            this.setState({ ignoredUserIds, waitingUnignored: newWaitingUnignored });
        }
    };

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
    }

    private updateAnalytics = (checked: boolean): void => {
        checked ? Analytics.enable() : Analytics.disable();
        CountlyAnalytics.instance.enable(/* anonymous = */ !checked);
        PosthogAnalytics.instance.updateAnonymityFromSettings(MatrixClientPeg.get().getUserId());
    };

    private onGoToUserProfileClick = (): void => {
        dis.dispatch({
            action: 'view_user_info',
            userId: MatrixClientPeg.get().getUserId(),
        });
        this.props.closeSettingsFn();
    };

    private onUserUnignored = async (userId: string): Promise<void> => {
        const { ignoredUserIds, waitingUnignored } = this.state;
        const currentlyIgnoredUserIds = ignoredUserIds.filter(e => !waitingUnignored.includes(e));

        const index = currentlyIgnoredUserIds.indexOf(userId);
        if (index !== -1) {
            currentlyIgnoredUserIds.splice(index, 1);
            this.setState(({ waitingUnignored }) => ({ waitingUnignored: [...waitingUnignored, userId] }));
            MatrixClientPeg.get().setIgnoredUsers(currentlyIgnoredUserIds);
        }
    };

    private getInvitedRooms = (): Room[] => {
        return MatrixClientPeg.get().getRooms().filter((r) => {
            return r.hasMembershipState(MatrixClientPeg.get().getUserId(), "invite");
        });
    };

    private manageInvites = async (accept: boolean): Promise<void> => {
        this.setState({
            managingInvites: true,
        });

        // Compile array of invitation room ids
        const invitedRoomIds = this.getInvitedRooms().map((room) => {
            return room.roomId;
        });

        // Execute all acceptances/rejections sequentially
        const cli = MatrixClientPeg.get();
        const action = accept ? cli.joinRoom.bind(cli) : cli.leave.bind(cli);
        for (let i = 0; i < invitedRoomIds.length; i++) {
            const roomId = invitedRoomIds[i];

            // Accept/reject invite
            await action(roomId).then(() => {
                // No error, update invited rooms button
                this.setState({ invitedRoomAmt: this.state.invitedRoomAmt - 1 });
            }, async (e) => {
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
            });
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
            ? _t('You have no ignored users.')
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
            <div className='mx_SettingsTab_section'>
                <span className='mx_SettingsTab_subheading'>{ _t('Ignored users') }</span>
                <div className='mx_SettingsTab_subsectionText'>
                    { userIds }
                </div>
            </div>
        );
    }

    private renderManageInvites(): JSX.Element {
        if (this.state.invitedRoomAmt === 0) {
            return null;
        }

        const invitedRooms = this.getInvitedRooms();
        const onClickAccept = this.onAcceptAllInvitesClicked.bind(this, invitedRooms);
        const onClickReject = this.onRejectAllInvitesClicked.bind(this, invitedRooms);
        return (
            <div className='mx_SettingsTab_section mx_SecurityUserSettingsTab_bulkOptions'>
                <span className='mx_SettingsTab_subheading'>{ _t('Bulk options') }</span>
                <AccessibleButton onClick={onClickAccept} kind='primary' disabled={this.state.managingInvites}>
                    { _t("Accept all %(invitedRooms)s invites", { invitedRooms: this.state.invitedRoomAmt }) }
                </AccessibleButton>
                <AccessibleButton onClick={onClickReject} kind='danger' disabled={this.state.managingInvites}>
                    { _t("Reject all %(invitedRooms)s invites", { invitedRooms: this.state.invitedRoomAmt }) }
                </AccessibleButton>
                { this.state.managingInvites ? <InlineSpinner /> : <div /> }
            </div>
        );
    }

    public render(): JSX.Element {
        const brand = SdkConfig.get().brand;

        const secureBackup = (
            <div className='mx_SettingsTab_section'>
                <span className="mx_SettingsTab_subheading">{ _t("Secure Backup") }</span>
                <div className='mx_SettingsTab_subsectionText'>
                    <SecureBackupPanel />
                </div>
            </div>
        );

        const eventIndex = (
            <div className="mx_SettingsTab_section">
                <span className="mx_SettingsTab_subheading">{ _t("Message search") }</span>
                <EventIndexPanel />
            </div>
        );

        // XXX: There's no such panel in the current cross-signing designs, but
        // it's useful to have for testing the feature. If there's no interest
        // in having advanced details here once all flows are implemented, we
        // can remove this.
        const crossSigning = (
            <div className='mx_SettingsTab_section'>
                <span className="mx_SettingsTab_subheading">{ _t("Cross-signing") }</span>
                <div className='mx_SettingsTab_subsectionText'>
                    <CrossSigningPanel />
                </div>
            </div>
        );

        let warning;
        if (!privateShouldBeEncrypted()) {
            warning = <div className="mx_SecurityUserSettingsTab_warning">
                { _t("Your server admin has disabled end-to-end encryption by default " +
                    "in private rooms & Direct Messages.") }
            </div>;
        }

        let privacySection;
        if (Analytics.canEnable() || CountlyAnalytics.instance.canEnable()) {
            privacySection = <React.Fragment>
                <div className="mx_SettingsTab_heading">{ _t("Privacy") }</div>
                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Analytics") }</span>
                    <div className="mx_SettingsTab_subsectionText">
                        { _t(
                            "%(brand)s collects anonymous analytics to allow us to improve the application.",
                            { brand },
                        ) }
                        &nbsp;
                        { _t("Privacy is important to us, so we don't collect any personal or " +
                            "identifiable data for our analytics.") }
                        <AccessibleButton className="mx_SettingsTab_linkBtn" onClick={Analytics.showDetailsModal}>
                            { _t("Learn more about how we use analytics.") }
                        </AccessibleButton>
                    </div>
                    <SettingsFlag name="analyticsOptIn" level={SettingLevel.DEVICE} onChange={this.updateAnalytics} />
                </div>
            </React.Fragment>;
        }

        let advancedSection;
        if (SettingsStore.getValue(UIFeature.AdvancedSettings)) {
            const ignoreUsersPanel = this.renderIgnoredUsers();
            const invitesPanel = this.renderManageInvites();
            const e2ePanel = isE2eAdvancedPanelPossible() ? <E2eAdvancedPanel /> : null;
            // only show the section if there's something to show
            if (ignoreUsersPanel || invitesPanel || e2ePanel) {
                advancedSection = <>
                    <div className="mx_SettingsTab_heading">{ _t("Advanced") }</div>
                    <div className="mx_SettingsTab_section">
                        { ignoreUsersPanel }
                        { invitesPanel }
                        { e2ePanel }
                    </div>
                </>;
            }
        }

        return (
            <div className="mx_SettingsTab mx_SecurityUserSettingsTab">
                { warning }
                <div className="mx_SettingsTab_heading">{ _t("Where you’re logged in") }</div>
                <div className="mx_SettingsTab_section">
                    <span>
                        { _t(
                            "Manage the names of and sign out of your sessions below or " +
                            "<a>verify them in your User Profile</a>.", {},
                            {
                                a: sub => <AccessibleButton kind="link" onClick={this.onGoToUserProfileClick}>
                                    { sub }
                                </AccessibleButton>,
                            },
                        ) }
                    </span>
                    <div className='mx_SettingsTab_subsectionText'>
                        { _t("A session's public name is visible to people you communicate with") }
                        <DevicesPanel />
                    </div>
                </div>
                <div className="mx_SettingsTab_heading">{ _t("Encryption") }</div>
                <div className="mx_SettingsTab_section">
                    { secureBackup }
                    { eventIndex }
                    { crossSigning }
                    <CryptographyPanel />
                </div>
                { privacySection }
                { advancedSection }
            </div>
        );
    }
}
