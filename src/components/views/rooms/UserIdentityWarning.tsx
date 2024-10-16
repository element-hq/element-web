/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    CryptoEvent,
    EventType,
    KnownMembership,
    MatrixEvent,
    Room,
    RoomStateEvent,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import type { CryptoApi, UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { _t } from "../../../languageHandler";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import MemberAvatar from "../avatars/MemberAvatar";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { SDKContext } from "../../../contexts/SDKContext";

interface IProps {
    // The current room being viewed.
    room: Room;
}

interface IState {
    // The current room member that we are prompting the user to approve.
    currentPrompt: RoomMember | undefined;
}

// Does the given user's identity need to be approved?
async function userNeedsApproval(crypto: CryptoApi, userId: string): Promise<boolean> {
    const verificationStatus = await crypto.getUserVerificationStatus(userId);
    return verificationStatus.needsUserApproval;
}

/**
 * Displays a banner warning when there is an issue with a user's identity.
 *
 * Warns when an unverified user's identity has changed, and gives the user a
 * button to acknowledge the change.
 */
export default class UserIdentityWarning extends React.Component<IProps, IState> {
    // Which room members need their identity approved.
    private membersNeedingApproval: Map<string, RoomMember>;
    // Whether we got a verification status update while we were fetching a
    // user's verification status.
    //
    // We set the entry for a user to `false` when we fetch a user's
    // verification status, and remove the user's entry when we are done
    // fetching.  When we receive a verification status update, if the entry for
    // the user is `false`, we set it to `true`.  After we have finished
    // fetching the user's verification status, if the entry for the user is
    // `true`, rather than `false`, we know that we got an update, and so we
    // discard the value that we fetched.  We always use the value from the
    // update and consider it as the most up-to-date version.  If the fetched
    // value is more up-to-date, then we should be getting a new update soon
    // with the newer value, so it will fix itself in the end.
    private gotVerificationStatusUpdate: Map<string, boolean>;
    private mounted: boolean;
    private initialised: boolean;
    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);
        this.state = {
            currentPrompt: undefined,
        };
        this.membersNeedingApproval = new Map();
        this.gotVerificationStatusUpdate = new Map();
        this.mounted = true;
        this.initialised = false;
        this.addListeners();
    }

    public componentDidMount(): void {
        if (!MatrixClientPeg.safeGet().getCrypto()) return;
        if (this.props.room.hasEncryptionStateEvent()) {
            this.initialise().catch((e) => {
                logger.error("Error initialising UserIdentityWarning:", e);
            });
        }
    }

    public componentWillUnmount(): void {
        this.mounted = false;
        this.removeListeners();
    }

    // Select a new user to display a warning for.  This is called after the
    // current prompted user no longer needs their identity approved.
    private selectCurrentPrompt(): void {
        if (this.membersNeedingApproval.size === 0) {
            this.setState({
                currentPrompt: undefined,
            });
            return;
        }
        // We return the user with the smallest user ID.
        const keys = Array.from(this.membersNeedingApproval.keys()).sort((a, b) => a.localeCompare(b));
        this.setState({
            currentPrompt: this.membersNeedingApproval.get(keys[0]!),
        });
    }

    // Initialise the component.  Get the room members, check which ones need
    // their identity approved, and pick one to display.
    public async initialise(): Promise<void> {
        if (!this.mounted || this.initialised) {
            return;
        }
        this.initialised = true;

        const crypto = MatrixClientPeg.safeGet().getCrypto()!;
        const members = await this.props.room.getEncryptionTargetMembers();
        if (!this.mounted) {
            return;
        }

        for (const member of members) {
            const userId = member.userId;
            if (this.gotVerificationStatusUpdate.has(userId)) {
                // We're already checking their verification status, so we don't
                // need to do anything here.
                continue;
            }
            this.gotVerificationStatusUpdate.set(userId, false);
            if (await userNeedsApproval(crypto, userId)) {
                if (
                    !this.membersNeedingApproval.has(userId) &&
                    this.gotVerificationStatusUpdate.get(userId) === false
                ) {
                    this.membersNeedingApproval.set(userId, member);
                }
            }
            this.gotVerificationStatusUpdate.delete(userId);
        }
        if (!this.mounted) {
            return;
        }

        this.selectCurrentPrompt();
    }

    private addMemberNeedingApproval(userId: string): void {
        if (userId === MatrixClientPeg.safeGet().getUserId()) {
            // We always skip our own user, because we can't pin our own identity.
            return;
        }
        const member = this.props.room.getMember(userId);
        if (member) {
            this.membersNeedingApproval.set(userId, member);
            if (!this.state.currentPrompt) {
                // If we're not currently displaying a prompt, then we should
                // display a prompt for this user.
                this.selectCurrentPrompt();
            }
        }
    }

    private removeMemberNeedingApproval(userId: string): void {
        this.membersNeedingApproval.delete(userId);

        // If we removed the currently displayed user, we need to pick a new one
        // to display.
        if (this.state.currentPrompt?.userId === userId) {
            this.selectCurrentPrompt();
        }
    }

    private addListeners(): void {
        const cli = MatrixClientPeg.safeGet();
        cli.on(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
        cli.on(RoomStateEvent.Events, this.onRoomStateEvent);
    }

    private removeListeners(): void {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
            cli.removeListener(RoomStateEvent.Events, this.onRoomStateEvent);
        }
    }

    private onUserTrustStatusChanged = (userId: string, verificationStatus: UserVerificationStatus): void => {
        // Handle a change in user trust.  If the user's identity now needs
        // approval, make sure that a warning is shown.  If the user's identity
        // doesn't need approval, remove the warning (if any).

        if (!this.initialised) {
            return;
        }

        if (this.gotVerificationStatusUpdate.has(userId)) {
            this.gotVerificationStatusUpdate.set(userId, true);
        }

        if (verificationStatus.needsUserApproval) {
            this.addMemberNeedingApproval(userId);
        } else {
            this.removeMemberNeedingApproval(userId);
        }
    };

    private onRoomStateEvent = async (event: MatrixEvent): Promise<void> => {
        if (event.getRoomId() !== this.props.room.roomId) {
            return;
        }

        const eventType = event.getType();
        if (eventType === EventType.RoomEncryption && event.getStateKey() === "") {
            // Room is now encrypted, so we can initialise the component.
            return this.initialise().catch((e) => {
                logger.error("Error initialising UserIdentityWarning:", e);
            });
        } else if (eventType !== EventType.RoomMember) {
            return;
        }

        if (!this.initialised) {
            return;
        }

        const userId = event.getStateKey();

        if (!userId) return;

        if (
            event.getContent().membership === KnownMembership.Join ||
            (event.getContent().membership === KnownMembership.Join && this.props.room.shouldEncryptForInvitedMembers())
        ) {
            // Someone's membership changed and we will now encrypt to them.  If
            // their identity needs approval, show a warning.
            if (this.gotVerificationStatusUpdate.has(userId)) {
                // We're already checking their verification status, so we don't
                // need to do anything here.
                return;
            }
            this.gotVerificationStatusUpdate.set(userId, false);
            const crypto = MatrixClientPeg.safeGet().getCrypto()!;
            if (await userNeedsApproval(crypto, userId)) {
                if (
                    !this.membersNeedingApproval.has(userId) &&
                    this.gotVerificationStatusUpdate.get(userId) === false
                ) {
                    this.addMemberNeedingApproval(userId);
                }
            }
            this.gotVerificationStatusUpdate.delete(userId);
        } else {
            // Someone's membership changed and we no longer encrypt to them.
            // If we're showing a warning about them, we don't need to any more.
            this.removeMemberNeedingApproval(userId);
        }
    };

    // Callback for when the user hits the "OK" button
    public confirmIdentity = async (ev: ButtonEvent): Promise<void> => {
        if (this.state.currentPrompt) {
            await MatrixClientPeg.safeGet().getCrypto()!.pinCurrentUserIdentity(this.state.currentPrompt.userId);
        }
    };

    public render(): React.ReactNode {
        const { currentPrompt } = this.state;
        if (currentPrompt) {
            const substituteATag = (sub: string): React.ReactNode => (
                <a href="https://element.io/help#encryption18" target="_blank" rel="noreferrer noopener">
                    {sub}
                </a>
            );
            const substituteBTag = (sub: string): React.ReactNode => <b>{sub}</b>;
            return (
                <div className="mx_UserIdentityWarning">
                    <MemberAvatar member={currentPrompt} title={currentPrompt.userId} size="30px" />
                    <span className="mx_UserIdentityWarning_main">
                        {currentPrompt.rawDisplayName === currentPrompt.userId
                            ? _t(
                                  "encryption|pinned_identity_changed_no_displayname",
                                  { userId: currentPrompt.userId },
                                  {
                                      a: substituteATag,
                                      b: substituteBTag,
                                  },
                              )
                            : _t(
                                  "encryption|pinned_identity_changed",
                                  { displayName: currentPrompt.rawDisplayName, userId: currentPrompt.userId },
                                  {
                                      a: substituteATag,
                                      b: substituteBTag,
                                  },
                              )}
                    </span>
                    <AccessibleButton kind="primary" onClick={this.confirmIdentity}>
                        {_t("action|ok")}
                    </AccessibleButton>
                </div>
            );
        } else {
            return null;
        }
    }
}
