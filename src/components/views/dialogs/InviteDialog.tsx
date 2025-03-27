/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, type ReactNode, type SyntheticEvent } from "react";
import classNames from "classnames";
import { RoomMember, type Room, MatrixError, EventType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";
import { uniqBy } from "lodash";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { Icon as EmailPillAvatarIcon } from "../../../../res/img/icon-email-pill-avatar.svg";
import { _t, _td } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { makeRoomPermalink, makeUserPermalink } from "../../../utils/permalinks/Permalinks";
import DMRoomMap from "../../../utils/DMRoomMap";
import * as Email from "../../../email";
import { getDefaultIdentityServerUrl, setToDefaultIdentityServer } from "../../../utils/IdentityServerUtils";
import { buildActivityScores, buildMemberScores, compareMembers } from "../../../utils/SortMembers";
import { abbreviateUrl } from "../../../utils/UrlUtils";
import IdentityAuthClient from "../../../IdentityAuthClient";
import { humanizeTime } from "../../../utils/humanize";
import { type IInviteResult, inviteMultipleToRoom, showAnyInviteErrors } from "../../../RoomInvite";
import { Action } from "../../../dispatcher/actions";
import { DefaultTagID } from "../../../stores/room-list/models";
import RoomListStore from "../../../stores/room-list/RoomListStore";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { mediaFromMxc } from "../../../customisations/Media";
import BaseAvatar from "../avatars/BaseAvatar";
import { SearchResultAvatar } from "../avatars/SearchResultAvatar";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { selectText } from "../../../utils/strings";
import Field from "../elements/Field";
import TabbedView, { Tab, TabLocation } from "../../structures/TabbedView";
import Dialpad from "../voip/DialPad";
import QuestionDialog from "./QuestionDialog";
import Spinner from "../elements/Spinner";
import BaseDialog from "./BaseDialog";
import DialPadBackspaceButton from "../elements/DialPadBackspaceButton";
import LegacyCallHandler from "../../../LegacyCallHandler";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import CopyableText from "../elements/CopyableText";
import { type ScreenName } from "../../../PosthogTrackers";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import {
    DirectoryMember,
    type IDMUserTileProps,
    type Member,
    startDmOnFirstMessage,
    ThreepidMember,
} from "../../../utils/direct-messages";
import { InviteKind } from "./InviteDialogTypes";
import Modal from "../../../Modal";
import dis from "../../../dispatcher/dispatcher";
import { privateShouldBeEncrypted } from "../../../utils/rooms";
import { type NonEmptyArray } from "../../../@types/common";
import { UNKNOWN_PROFILE_ERRORS } from "../../../utils/MultiInviter";
import AskInviteAnywayDialog, { type UnknownProfiles } from "./AskInviteAnywayDialog";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { type UserProfilesStore } from "../../../stores/UserProfilesStore";

// we have a number of types defined from the Matrix spec which can't reasonably be altered here.
/* eslint-disable camelcase */

const extractTargetUnknownProfiles = async (
    targets: Member[],
    profilesStores: UserProfilesStore,
): Promise<UnknownProfiles> => {
    const directoryMembers = targets.filter((t): t is DirectoryMember => t instanceof DirectoryMember);
    await Promise.all(directoryMembers.map((t) => profilesStores.getOrFetchProfile(t.userId)));
    return directoryMembers.reduce<UnknownProfiles>((unknownProfiles: UnknownProfiles, target: DirectoryMember) => {
        const lookupError = profilesStores.getProfileLookupError(target.userId);

        if (
            lookupError instanceof MatrixError &&
            lookupError.errcode &&
            UNKNOWN_PROFILE_ERRORS.includes(lookupError.errcode)
        ) {
            unknownProfiles.push({
                userId: target.userId,
                errorText: lookupError.data.error || "",
            });
        }

        return unknownProfiles;
    }, []);
};

interface Result {
    userId: string;
    user: Member;
    lastActive?: number;
}

const INITIAL_ROOMS_SHOWN = 3; // Number of rooms to show at first
const INCREMENT_ROOMS_SHOWN = 5; // Number of rooms to add when 'show more' is clicked

enum TabId {
    UserDirectory = "users",
    DialPad = "dialpad",
}

class DMUserTile extends React.PureComponent<IDMUserTileProps> {
    private onRemove = (e: ButtonEvent): void => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        this.props.onRemove!(this.props.member);
    };

    public render(): React.ReactNode {
        const avatarSize = "20px";
        const avatar = <SearchResultAvatar user={this.props.member} size={avatarSize} />;

        let closeButton;
        if (this.props.onRemove) {
            closeButton = (
                <AccessibleButton
                    className="mx_InviteDialog_userTile_remove"
                    onClick={this.onRemove}
                    aria-label={_t("action|remove")}
                >
                    <CloseIcon width="16px" height="16px" />
                </AccessibleButton>
            );
        }

        return (
            <span className="mx_InviteDialog_userTile">
                <span className="mx_InviteDialog_userTile_pill">
                    {avatar}
                    <span className="mx_InviteDialog_userTile_name">{this.props.member.name}</span>
                </span>
                {closeButton}
            </span>
        );
    }
}

/**
 * Converts a RoomMember to a Member.
 * Returns the Member if it is already a Member.
 */
const toMember = (member: RoomMember | Member): Member => {
    return member instanceof RoomMember
        ? new DirectoryMember({
              user_id: member.userId,
              display_name: member.name,
              avatar_url: member.getMxcAvatarUrl(),
          })
        : member;
};

interface IDMRoomTileProps {
    member: Member;
    lastActiveTs?: number;
    onToggle(member: Member): void;
    highlightWord: string;
    isSelected: boolean;
}

class DMRoomTile extends React.PureComponent<IDMRoomTileProps> {
    private onClick = (e: ButtonEvent): void => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        this.props.onToggle(this.props.member);
    };

    private highlightName(str: string): ReactNode {
        if (!this.props.highlightWord) return str;

        // We convert things to lowercase for index searching, but pull substrings from
        // the submitted text to preserve case. Note: we don't need to htmlEntities the
        // string because React will safely encode the text for us.
        const lowerStr = str.toLowerCase();
        const filterStr = this.props.highlightWord.toLowerCase();

        const result: JSX.Element[] = [];

        let i = 0;
        let ii: number;
        while ((ii = lowerStr.indexOf(filterStr, i)) >= 0) {
            // Push any text we missed (first bit/middle of text)
            if (ii > i) {
                // Push any text we aren't highlighting (middle of text match, or beginning of text)
                result.push(<span key={i + "begin"}>{str.substring(i, ii)}</span>);
            }

            i = ii; // copy over ii only if we have a match (to preserve i for end-of-text matching)

            // Highlight the word the user entered
            const substr = str.substring(i, filterStr.length + i);
            result.push(
                <span className="mx_InviteDialog_tile--room_highlight" key={i + "bold"}>
                    {substr}
                </span>,
            );
            i += substr.length;
        }

        // Push any text we missed (end of text)
        if (i < str.length) {
            result.push(<span key={i + "end"}>{str.substring(i)}</span>);
        }

        return result;
    }

    public render(): React.ReactNode {
        let timestamp: JSX.Element | undefined;
        if (this.props.lastActiveTs) {
            const humanTs = humanizeTime(this.props.lastActiveTs);
            timestamp = <span className="mx_InviteDialog_tile--room_time">{humanTs}</span>;
        }

        const avatarSize = "36px";
        const avatar = (this.props.member as ThreepidMember).isEmail ? (
            <EmailPillAvatarIcon width={avatarSize} height={avatarSize} />
        ) : (
            <BaseAvatar
                url={
                    this.props.member.getMxcAvatarUrl()
                        ? mediaFromMxc(this.props.member.getMxcAvatarUrl()!).getSquareThumbnailHttp(
                              parseInt(avatarSize, 10),
                          )
                        : null
                }
                name={this.props.member.name}
                idName={this.props.member.userId}
                size={avatarSize}
            />
        );

        let checkmark: JSX.Element | undefined;
        if (this.props.isSelected) {
            // To reduce flickering we put the 'selected' room tile above the real avatar
            checkmark = <div className="mx_InviteDialog_tile--room_selected" />;
        }

        // To reduce flickering we put the checkmark on top of the actual avatar (prevents
        // the browser from reloading the image source when the avatar remounts).
        const stackedAvatar = (
            <span className="mx_InviteDialog_tile_avatarStack">
                {avatar}
                {checkmark}
            </span>
        );

        const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier(this.props.member.userId, {
            withDisplayName: true,
        });

        const caption = (this.props.member as ThreepidMember).isEmail
            ? _t("invite|email_caption")
            : this.highlightName(userIdentifier || this.props.member.userId);

        return (
            <AccessibleButton className="mx_InviteDialog_tile mx_InviteDialog_tile--room" onClick={this.onClick}>
                {stackedAvatar}
                <span className="mx_InviteDialog_tile_nameStack">
                    <div className="mx_InviteDialog_tile_nameStack_name">
                        {this.highlightName(this.props.member.name)}
                    </div>
                    <div className="mx_InviteDialog_tile_nameStack_userId">{caption}</div>
                </span>
                {timestamp}
            </AccessibleButton>
        );
    }
}

interface BaseProps {
    // Takes a boolean which is true if a user / users were invited /
    // a call transfer was initiated or false if the dialog was cancelled
    // with no action taken.
    onFinished: (success?: boolean) => void;

    // Initial value to populate the filter with
    initialText?: string;
}

interface InviteDMProps extends BaseProps {
    // The kind of invite being performed. Assumed to be InviteKind.Dm if not provided.
    kind?: InviteKind.Dm;
}

interface InviteRoomProps extends BaseProps {
    kind: InviteKind.Invite;

    // The room ID this dialog is for. Only required for InviteKind.Invite.
    roomId: string;
}

function isRoomInvite(props: Props): props is InviteRoomProps {
    return props.kind === InviteKind.Invite;
}

interface InviteCallProps extends BaseProps {
    kind: InviteKind.CallTransfer;

    // The call to transfer. Only required for InviteKind.CallTransfer.
    call: MatrixCall;
}

type Props = InviteDMProps | InviteRoomProps | InviteCallProps;

interface IInviteDialogState {
    targets: Member[]; // array of Member objects (see interface above)
    filterText: string;
    recents: Result[];
    numRecentsShown: number;
    suggestions: Result[];
    numSuggestionsShown: number;
    serverResultsMixin: Result[];
    threepidResultsMixin: Result[];
    canUseIdentityServer: boolean;
    tryingIdentityServer: boolean;
    consultFirst: boolean;
    dialPadValue: string;
    currentTabId: TabId;

    // These two flags are used for the 'Go' button to communicate what is going on.
    busy: boolean;
    errorText?: string;
}

export default class InviteDialog extends React.PureComponent<Props, IInviteDialogState> {
    public static defaultProps: Partial<Props> = {
        kind: InviteKind.Dm,
        initialText: "",
    };

    private debounceTimer: number | null = null; // actually number because we're in the browser
    private editorRef = createRef<HTMLInputElement>();
    private numberEntryFieldRef = createRef<Field>();
    private unmounted = false;
    private encryptionByDefault = false;
    private profilesStore: UserProfilesStore;

    public constructor(props: Props) {
        super(props);

        if (props.kind === InviteKind.Invite && !props.roomId) {
            throw new Error("When using InviteKind.Invite a roomId is required for an InviteDialog");
        } else if (props.kind === InviteKind.CallTransfer && !props.call) {
            throw new Error("When using InviteKind.CallTransfer a call is required for an InviteDialog");
        }

        this.profilesStore = SdkContextClass.instance.userProfilesStore;

        const excludedIds = new Set([MatrixClientPeg.safeGet().getUserId()!]);
        if (isRoomInvite(props)) {
            const room = MatrixClientPeg.safeGet().getRoom(props.roomId);
            const isFederated = room?.currentState.getStateEvents(EventType.RoomCreate, "")?.getContent()["m.federate"];
            if (!room) throw new Error("Room ID given to InviteDialog does not look like a room");
            room.getMembersWithMembership(KnownMembership.Invite).forEach((m) => excludedIds.add(m.userId));
            room.getMembersWithMembership(KnownMembership.Join).forEach((m) => excludedIds.add(m.userId));
            // add banned users, so we don't try to invite them
            room.getMembersWithMembership(KnownMembership.Ban).forEach((m) => excludedIds.add(m.userId));
            if (isFederated === false) {
                // exclude users from external servers
                const homeserver = props.roomId.split(":")[1];
                this.excludeExternals(homeserver, excludedIds);
            }
        }

        this.state = {
            targets: [], // array of Member objects (see interface above)
            filterText: this.props.initialText || "",
            // Mutates alreadyInvited set so that buildSuggestions doesn't duplicate any users
            recents: InviteDialog.buildRecents(excludedIds),
            numRecentsShown: INITIAL_ROOMS_SHOWN,
            suggestions: this.buildSuggestions(excludedIds),
            numSuggestionsShown: INITIAL_ROOMS_SHOWN,
            serverResultsMixin: [],
            threepidResultsMixin: [],
            canUseIdentityServer: !!MatrixClientPeg.safeGet().getIdentityServerUrl(),
            tryingIdentityServer: false,
            consultFirst: false,
            dialPadValue: "",
            currentTabId: TabId.UserDirectory,

            // These two flags are used for the 'Go' button to communicate what is going on.
            busy: false,
        };
    }

    public componentDidMount(): void {
        this.unmounted = false;
        this.encryptionByDefault = privateShouldBeEncrypted(MatrixClientPeg.safeGet());

        if (this.props.initialText) {
            this.updateSuggestions(this.props.initialText);
        }
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onConsultFirstChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ consultFirst: ev.target.checked });
    };

    private excludeExternals(homeserver: string, excludedTargetIds: Set<string>): void {
        const client = MatrixClientPeg.safeGet();
        // users with room membership
        const members = Object.values(buildMemberScores(client)).map(({ member }) => member.userId);
        // users with dm membership
        const roomMembers = Object.keys(DMRoomMap.shared().getUniqueRoomsWithIndividuals());
        roomMembers.forEach((id) => members.push(id));
        // filter duplicates and user IDs from external servers
        const externals = new Set(members.filter((id) => !id.includes(homeserver)));
        externals.forEach((id) => excludedTargetIds.add(id));
    }

    public static buildRecents(excludedTargetIds: Set<string>): Result[] {
        const rooms = DMRoomMap.shared().getUniqueRoomsWithIndividuals(); // map of userId => js-sdk Room

        // Also pull in all the rooms tagged as DefaultTagID.DM so we don't miss anything. Sometimes the
        // room list doesn't tag the room for the DMRoomMap, but does for the room list.
        const dmTaggedRooms = RoomListStore.instance.orderedLists[DefaultTagID.DM] || [];
        const myUserId = MatrixClientPeg.safeGet().getUserId();
        for (const dmRoom of dmTaggedRooms) {
            const otherMembers = dmRoom.getJoinedMembers().filter((u) => u.userId !== myUserId);
            for (const member of otherMembers) {
                if (rooms[member.userId]) continue; // already have a room

                logger.warn(`Adding DM room for ${member.userId} as ${dmRoom.roomId} from tag, not DM map`);
                rooms[member.userId] = dmRoom;
            }
        }

        const recents: {
            userId: string;
            user: Member;
            lastActive: number;
        }[] = [];

        for (const userId in rooms) {
            // Filter out user IDs that are already in the room / should be excluded
            if (excludedTargetIds.has(userId)) {
                logger.warn(`[Invite:Recents] Excluding ${userId} from recents`);
                continue;
            }

            const room = rooms[userId];
            const roomMember = room.getMember(userId);
            if (!roomMember) {
                // just skip people who don't have memberships for some reason
                logger.warn(`[Invite:Recents] ${userId} is missing a member object in their own DM (${room.roomId})`);
                continue;
            }

            // Find the last timestamp for a message event
            const searchTypes = ["m.room.message", "m.room.encrypted", "m.sticker"];
            const maxSearchEvents = 20; // to prevent traversing history
            let lastEventTs = 0;
            if (room.timeline && room.timeline.length) {
                for (let i = room.timeline.length - 1; i >= 0; i--) {
                    const ev = room.timeline[i];
                    if (searchTypes.includes(ev.getType())) {
                        lastEventTs = ev.getTs();
                        break;
                    }
                    if (room.timeline.length - i > maxSearchEvents) break;
                }
            }
            if (!lastEventTs) {
                // something weird is going on with this room
                logger.warn(`[Invite:Recents] ${userId} (${room.roomId}) has a weird last timestamp: ${lastEventTs}`);
                continue;
            }

            recents.push({ userId, user: toMember(roomMember), lastActive: lastEventTs });
            // We mutate the given set so that any later callers avoid duplicating these users
            excludedTargetIds.add(userId);
        }
        if (!recents) logger.warn("[Invite:Recents] No recents to suggest!");

        // Sort the recents by last active to save us time later
        recents.sort((a, b) => b.lastActive - a.lastActive);

        return recents;
    }

    private buildSuggestions(excludedTargetIds: Set<string>): { userId: string; user: Member }[] {
        const cli = MatrixClientPeg.safeGet();
        const activityScores = buildActivityScores(cli);
        const memberScores = buildMemberScores(cli);

        const memberComparator = compareMembers(activityScores, memberScores);

        return Object.values(memberScores)
            .map(({ member }) => member)
            .filter((member) => !excludedTargetIds.has(member.userId))
            .sort(memberComparator)
            .map((member) => ({ userId: member.userId, user: toMember(member) }));
    }

    private shouldAbortAfterInviteError(result: IInviteResult, room: Room): boolean {
        this.setState({ busy: false });
        const userMap = new Map<string, Member>(this.state.targets.map((member) => [member.userId, member]));
        return !showAnyInviteErrors(result.states, room, result.inviter, userMap);
    }

    private convertFilter(): Member[] {
        // Check to see if there's anything to convert first
        if (!this.state.filterText || !this.state.filterText.includes("@")) return this.state.targets || [];

        if (!this.canInviteMore()) {
            // There should only be one third-party invite → do not allow more targets
            return this.state.targets;
        }

        let newMember: Member | undefined;
        if (this.state.filterText.startsWith("@")) {
            // Assume mxid
            newMember = new DirectoryMember({ user_id: this.state.filterText });
        } else if (SettingsStore.getValue(UIFeature.IdentityServer)) {
            // Assume email
            if (this.canInviteThirdParty()) {
                newMember = new ThreepidMember(this.state.filterText);
            }
        }
        if (!newMember) return this.state.targets;

        const newTargets = [...(this.state.targets || []), newMember];
        this.setState({ targets: newTargets, filterText: "" });
        return newTargets;
    }

    /**
     * Check if there are unknown profiles if promptBeforeInviteUnknownUsers setting is enabled.
     * If so show the "invite anyway?" dialog. Otherwise directly create the DM local room.
     */
    private checkProfileAndStartDm = async (): Promise<void> => {
        this.setBusy(true);
        const targets = this.convertFilter();

        if (SettingsStore.getValue("promptBeforeInviteUnknownUsers")) {
            const unknownProfileUsers = await extractTargetUnknownProfiles(targets, this.profilesStore);

            if (unknownProfileUsers.length) {
                this.showAskInviteAnywayDialog(unknownProfileUsers);
                return;
            }
        }

        await this.startDm();
    };

    private startDm = async (): Promise<void> => {
        this.setBusy(true);

        try {
            const cli = MatrixClientPeg.safeGet();
            const targets = this.convertFilter();
            await startDmOnFirstMessage(cli, targets);
            this.props.onFinished(true);
        } catch (err) {
            logger.error(err);
            this.setState({
                busy: false,
                errorText: _t("invite|error_dm"),
            });
        }
    };

    private setBusy(busy: boolean): void {
        this.setState({
            busy,
        });
    }

    private showAskInviteAnywayDialog(unknownProfileUsers: { userId: string; errorText: string }[]): void {
        Modal.createDialog(AskInviteAnywayDialog, {
            unknownProfileUsers,
            onInviteAnyways: () => this.startDm(),
            onGiveUp: () => {
                this.setBusy(false);
            },
            description: _t("invite|ask_anyway_description"),
            inviteNeverWarnLabel: _t("invite|ask_anyway_never_warn_label"),
            inviteLabel: _t("invite|ask_anyway_label"),
        });
    }

    private inviteUsers = async (): Promise<void> => {
        if (this.props.kind !== InviteKind.Invite) return;
        this.setState({ busy: true });
        this.convertFilter();
        const targets = this.convertFilter();
        const targetIds = targets.map((t) => t.userId);

        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(this.props.roomId);
        if (!room) {
            logger.error("Failed to find the room to invite users to");
            this.setState({
                busy: false,
                errorText: _t("invite|error_find_room"),
            });
            return;
        }

        try {
            const result = await inviteMultipleToRoom(cli, this.props.roomId, targetIds);
            if (!this.shouldAbortAfterInviteError(result, room)) {
                // handles setting error message too
                this.props.onFinished(true);
            }
        } catch (err) {
            logger.error(err);
            this.setState({
                busy: false,
                errorText: _t("invite|error_invite"),
            });
        }
    };

    private transferCall = async (): Promise<void> => {
        if (this.props.kind !== InviteKind.CallTransfer) return;
        if (this.state.currentTabId == TabId.UserDirectory) {
            this.convertFilter();
            const targets = this.convertFilter();
            const targetIds = targets.map((t) => t.userId);
            if (targetIds.length > 1) {
                this.setState({
                    errorText: _t("invite|error_transfer_multiple_target"),
                });
                return;
            }

            LegacyCallHandler.instance.startTransferToMatrixID(this.props.call, targetIds[0], this.state.consultFirst);
        } else {
            LegacyCallHandler.instance.startTransferToPhoneNumber(
                this.props.call,
                this.state.dialPadValue,
                this.state.consultFirst,
            );
        }
        this.props.onFinished(true);
    };

    private onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (this.state.busy) return;

        let handled = false;
        const value = e.currentTarget.value.trim();
        const action = getKeyBindingsManager().getAccessibilityAction(e);

        switch (action) {
            case KeyBindingAction.Backspace:
                if (value || this.state.targets.length <= 0) break;

                // when the field is empty and the user hits backspace remove the right-most target
                this.removeMember(this.state.targets[this.state.targets.length - 1]);
                handled = true;
                break;
            case KeyBindingAction.Space:
                if (!value || !value.includes("@") || value.includes(" ")) break;

                // when the user hits space and their input looks like an e-mail/MXID then try to convert it
                this.convertFilter();
                handled = true;
                break;
            case KeyBindingAction.Enter:
                if (!value) break;

                // when the user hits enter with something in their field try to convert it
                this.convertFilter();
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
        }
    };

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private updateSuggestions = async (term: string): Promise<void> => {
        MatrixClientPeg.safeGet()
            .searchUserDirectory({ term })
            .then(async (r): Promise<void> => {
                if (term !== this.state.filterText) {
                    // Discard the results - we were probably too slow on the server-side to make
                    // these results useful. This is a race we want to avoid because we could overwrite
                    // more accurate results.
                    return;
                }

                if (!r.results) r.results = [];

                // While we're here, try and autocomplete a search result for the mxid itself
                // if there's no matches (and the input looks like a mxid).
                if (term[0] === "@" && term.indexOf(":") > 1) {
                    try {
                        const profile = await this.profilesStore.getOrFetchProfile(term, { shouldThrow: true });

                        if (profile) {
                            // If we have a profile, we have enough information to assume that
                            // the mxid can be invited - add it to the list. We stick it at the
                            // top so it is most obviously presented to the user.
                            r.results.splice(0, 0, {
                                user_id: term,
                                display_name: profile["displayname"],
                                avatar_url: profile["avatar_url"],
                            });
                        }
                    } catch (e) {
                        logger.warn("Non-fatal error trying to make an invite for a user ID", e);
                    }
                }

                this.setState({
                    serverResultsMixin: r.results.map((u) => ({
                        userId: u.user_id,
                        user: new DirectoryMember(u),
                    })),
                });
            })
            .catch((e) => {
                logger.error("Error searching user directory:");
                logger.error(e);
                this.setState({ serverResultsMixin: [] }); // clear results because it's moderately fatal
            });

        // Whenever we search the directory, also try to search the identity server. It's
        // all debounced the same anyways.
        if (!this.state.canUseIdentityServer) {
            // The user doesn't have an identity server set - warn them of that.
            this.setState({ tryingIdentityServer: true });
            return;
        }
        if (Email.looksValid(term) && this.canInviteThirdParty() && SettingsStore.getValue(UIFeature.IdentityServer)) {
            // Start off by suggesting the plain email while we try and resolve it
            // to a real account.
            this.setState({
                // per above: the userId is a lie here - it's just a regular identifier
                threepidResultsMixin: [{ user: new ThreepidMember(term), userId: term }],
            });
            try {
                const authClient = new IdentityAuthClient();
                const token = await authClient.getAccessToken();
                // No token → unable to try a lookup
                if (!token) return;

                if (term !== this.state.filterText) return; // abandon hope

                const lookup = await MatrixClientPeg.safeGet().lookupThreePid("email", term, token);
                if (term !== this.state.filterText) return; // abandon hope

                if (!lookup || !("mxid" in lookup)) {
                    // We weren't able to find anyone - we're already suggesting the plain email
                    // as an alternative, so do nothing.
                    return;
                }

                // We append the user suggestion to give the user an option to click
                // the email anyways, and so we don't cause things to jump around. In
                // theory, the user would see the user pop up and think "ah yes, that
                // person!"
                const profile = await this.profilesStore.getOrFetchProfile(lookup.mxid);
                if (term !== this.state.filterText || !profile) return; // abandon hope
                this.setState({
                    threepidResultsMixin: [
                        ...this.state.threepidResultsMixin,
                        {
                            user: new DirectoryMember({
                                user_id: lookup.mxid,
                                display_name: profile.displayname,
                                avatar_url: profile.avatar_url,
                            }),
                            // Use the search term as identifier, so that it shows up in suggestions.
                            userId: term,
                        },
                    ],
                });
            } catch (e) {
                logger.error("Error searching identity server:");
                logger.error(e);
                this.setState({ threepidResultsMixin: [] }); // clear results because it's moderately fatal
            }
        }
    };

    private updateFilter = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const term = e.target.value;
        this.setState({ filterText: term });

        // Debounce server lookups to reduce spam. We don't clear the existing server
        // results because they might still be vaguely accurate, likewise for races which
        // could happen here.
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
            this.updateSuggestions(term);
        }, 150); // 150ms debounce (human reaction time + some)
    };

    private showMoreRecents = (): void => {
        this.setState({ numRecentsShown: this.state.numRecentsShown + INCREMENT_ROOMS_SHOWN });
    };

    private showMoreSuggestions = (): void => {
        this.setState({ numSuggestionsShown: this.state.numSuggestionsShown + INCREMENT_ROOMS_SHOWN });
    };

    private toggleMember = (member: Member): void => {
        if (!this.state.busy) {
            let filterText = this.state.filterText;
            let targets = this.state.targets.map((t) => t); // cheap clone for mutation
            const idx = targets.findIndex((m) => m.userId === member.userId);
            if (idx >= 0) {
                targets.splice(idx, 1);
            } else {
                if (this.props.kind === InviteKind.CallTransfer && targets.length > 0) {
                    targets = [];
                }
                targets.push(member);
                filterText = ""; // clear the filter when the user accepts a suggestion
            }
            this.setState({ targets, filterText });

            if (this.editorRef && this.editorRef.current) {
                this.editorRef.current.focus();
            }
        }
    };

    private removeMember = (member: Member): void => {
        const targets = this.state.targets.map((t) => t); // cheap clone for mutation
        const idx = targets.indexOf(member);
        if (idx >= 0) {
            targets.splice(idx, 1);
            this.setState({ targets });
        }

        if (this.editorRef && this.editorRef.current) {
            this.editorRef.current.focus();
        }
    };

    private parseFilter(filter: string): string[] {
        return filter
            .split(/[\s,]+/)
            .map((p) => p.trim())
            .filter((p) => !!p); // filter empty strings
    }

    private onPaste = async (e: React.ClipboardEvent): Promise<void> => {
        if (this.state.filterText) {
            // if the user has already typed something, just let them
            // paste normally.
            return;
        }

        const text = e.clipboardData.getData("text");
        const potentialAddresses = this.parseFilter(text);
        // one search term which is not a mxid or email address
        if (potentialAddresses.length === 1 && !potentialAddresses[0].includes("@")) {
            return;
        }

        // Prevent the text being pasted into the input
        e.preventDefault();

        // Process it as a list of addresses to add instead
        const possibleMembers = [
            // If we can avoid hitting the profile endpoint, we should.
            ...this.state.recents,
            ...this.state.suggestions,
            ...this.state.serverResultsMixin,
            ...this.state.threepidResultsMixin,
        ];
        const toAdd: Member[] = [];
        const failed: string[] = [];

        // Addresses that could not be added.
        // Will be displayed as filter text to provide feedback.
        const unableToAddMore: string[] = [];

        for (const address of potentialAddresses) {
            const member = possibleMembers.find((m) => m.userId === address);
            if (member) {
                if (this.canInviteMore([...this.state.targets, ...toAdd])) {
                    toAdd.push(member.user);
                } else {
                    // Invite not possible for current targets and pasted targets.
                    unableToAddMore.push(address);
                }
                continue;
            }

            if (Email.looksValid(address)) {
                if (this.canInviteThirdParty([...this.state.targets, ...toAdd])) {
                    toAdd.push(new ThreepidMember(address));
                } else {
                    // Third-party invite not possible for current targets and pasted targets.
                    unableToAddMore.push(address);
                }
                continue;
            }

            if (address[0] !== "@") {
                failed.push(address); // not a user ID
                continue;
            }

            try {
                const profile = await this.profilesStore.getOrFetchProfile(address);
                toAdd.push(
                    new DirectoryMember({
                        user_id: address,
                        display_name: profile?.displayname,
                        avatar_url: profile?.avatar_url,
                    }),
                );
            } catch (e) {
                logger.error("Error looking up profile for " + address);
                logger.error(e);
                failed.push(address);
            }
        }
        if (this.unmounted) return;

        if (failed.length > 0) {
            Modal.createDialog(QuestionDialog, {
                title: _t("invite|error_find_user_title"),
                description: _t("invite|error_find_user_description", { csvNames: failed.join(", ") }),
                button: _t("action|ok"),
            });
        }

        if (unableToAddMore) {
            this.setState({
                filterText: unableToAddMore.join(" "),
                targets: uniqBy([...this.state.targets, ...toAdd], (t) => t.userId),
            });
        } else {
            this.setState({
                targets: uniqBy([...this.state.targets, ...toAdd], (t) => t.userId),
            });
        }
    };

    private onClickInputArea = (e: React.MouseEvent): void => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        if (this.editorRef && this.editorRef.current) {
            this.editorRef.current.focus();
        }
    };

    private onUseDefaultIdentityServerClick = (e: ButtonEvent): void => {
        e.preventDefault();

        // Update the IS in account data. Actually using it may trigger terms.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        setToDefaultIdentityServer(MatrixClientPeg.safeGet());
        this.setState({ canUseIdentityServer: true, tryingIdentityServer: false });
    };

    private onManageSettingsClick = (e: ButtonEvent): void => {
        e.preventDefault();
        dis.fire(Action.ViewUserSettings);
        this.props.onFinished(false);
    };

    private renderSection(kind: "recents" | "suggestions"): ReactNode {
        let sourceMembers = kind === "recents" ? this.state.recents : this.state.suggestions;
        let showNum = kind === "recents" ? this.state.numRecentsShown : this.state.numSuggestionsShown;
        const showMoreFn = kind === "recents" ? this.showMoreRecents.bind(this) : this.showMoreSuggestions.bind(this);
        const lastActive = (m: Result): number | undefined => (kind === "recents" ? m.lastActive : undefined);
        let sectionName = kind === "recents" ? _t("invite|recents_section") : _t("common|suggestions");

        if (this.props.kind === InviteKind.Invite) {
            sectionName = kind === "recents" ? _t("invite|suggestions_section") : _t("common|suggestions");
        }

        // Mix in the server results if we have any, but only if we're searching. We track the additional
        // members separately because we want to filter sourceMembers but trust the mixin arrays to have
        // the right members in them.
        let priorityAdditionalMembers: Result[] = []; // Shows up before our own suggestions, higher quality
        let otherAdditionalMembers: Result[] = []; // Shows up after our own suggestions, lower quality
        const hasMixins = this.state.serverResultsMixin || this.state.threepidResultsMixin;
        if (this.state.filterText && hasMixins && kind === "suggestions") {
            // We don't want to duplicate members though, so just exclude anyone we've already seen.
            // The type of u is a pain to define but members of both mixins have the 'userId' property
            const notAlreadyExists = (u: any): boolean => {
                return (
                    !this.state.recents.some((m) => m.userId === u.userId) &&
                    !sourceMembers.some((m) => m.userId === u.userId) &&
                    !priorityAdditionalMembers.some((m) => m.userId === u.userId) &&
                    !otherAdditionalMembers.some((m) => m.userId === u.userId)
                );
            };

            otherAdditionalMembers = this.state.serverResultsMixin.filter(notAlreadyExists);
            priorityAdditionalMembers = this.state.threepidResultsMixin.filter(notAlreadyExists);
        }
        const hasAdditionalMembers = priorityAdditionalMembers.length > 0 || otherAdditionalMembers.length > 0;

        // Hide the section if there's nothing to filter by
        if (sourceMembers.length === 0 && !hasAdditionalMembers) return null;

        if (!this.canInviteThirdParty()) {
            // It is currently not allowed to add more third-party invites. Filter them out.
            priorityAdditionalMembers = priorityAdditionalMembers.filter((s) => s instanceof ThreepidMember);
        }

        // Do some simple filtering on the input before going much further. If we get no results, say so.
        if (this.state.filterText) {
            const filterBy = this.state.filterText.toLowerCase();
            sourceMembers = sourceMembers.filter(
                (m) => m.user.name.toLowerCase().includes(filterBy) || m.userId.toLowerCase().includes(filterBy),
            );

            if (sourceMembers.length === 0 && !hasAdditionalMembers) {
                return (
                    <div className="mx_InviteDialog_section">
                        <h3>{sectionName}</h3>
                        <p>{_t("common|no_results")}</p>
                    </div>
                );
            }
        }

        // Now we mix in the additional members. Again, we presume these have already been filtered. We
        // also assume they are more relevant than our suggestions and prepend them to the list.
        sourceMembers = [...priorityAdditionalMembers, ...sourceMembers, ...otherAdditionalMembers];

        // If we're going to hide one member behind 'show more', just use up the space of the button
        // with the member's tile instead.
        if (showNum === sourceMembers.length - 1) showNum++;

        // .slice() will return an incomplete array but won't error on us if we go too far
        const toRender = sourceMembers.slice(0, showNum);
        const hasMore = toRender.length < sourceMembers.length;

        let showMore: JSX.Element | undefined;
        if (hasMore) {
            showMore = (
                <div className="mx_InviteDialog_section_showMore">
                    <AccessibleButton onClick={showMoreFn} kind="link">
                        {_t("common|show_more")}
                    </AccessibleButton>
                </div>
            );
        }

        const tiles = toRender.map((r) => (
            <DMRoomTile
                member={r.user}
                lastActiveTs={lastActive(r)}
                key={r.user.userId}
                onToggle={this.toggleMember}
                highlightWord={this.state.filterText}
                isSelected={this.state.targets.some((t) => t.userId === r.userId)}
            />
        ));
        return (
            <div className="mx_InviteDialog_section">
                <h3>{sectionName}</h3>
                {tiles}
                {showMore}
            </div>
        );
    }

    private renderEditor(): JSX.Element {
        const hasPlaceholder =
            this.props.kind == InviteKind.CallTransfer &&
            this.state.targets.length === 0 &&
            this.state.filterText.length === 0;
        const targets = this.state.targets.map((t) => (
            <DMUserTile member={t} onRemove={this.state.busy ? undefined : this.removeMember} key={t.userId} />
        ));
        const input = (
            <input
                type="text"
                onKeyDown={this.onKeyDown}
                onChange={this.updateFilter}
                value={this.state.filterText}
                ref={this.editorRef}
                onPaste={this.onPaste}
                autoFocus={true}
                disabled={
                    this.state.busy || (this.props.kind == InviteKind.CallTransfer && this.state.targets.length > 0)
                }
                autoComplete="off"
                placeholder={hasPlaceholder ? _t("action|search") : undefined}
                data-testid="invite-dialog-input"
            />
        );
        return (
            <div className="mx_InviteDialog_editor" onClick={this.onClickInputArea}>
                {targets}
                {input}
            </div>
        );
    }

    private renderIdentityServerWarning(): ReactNode {
        if (
            !this.state.tryingIdentityServer ||
            this.state.canUseIdentityServer ||
            !SettingsStore.getValue(UIFeature.IdentityServer)
        ) {
            return null;
        }

        const defaultIdentityServerUrl = getDefaultIdentityServerUrl();
        if (defaultIdentityServerUrl) {
            return (
                <div className="mx_InviteDialog_identityServer">
                    {_t(
                        "invite|email_use_default_is",
                        {
                            defaultIdentityServerName: abbreviateUrl(defaultIdentityServerUrl),
                        },
                        {
                            default: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onUseDefaultIdentityServerClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                            settings: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onManageSettingsClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </div>
            );
        } else {
            return (
                <div className="mx_InviteDialog_identityServer">
                    {_t(
                        "invite|email_use_is",
                        {},
                        {
                            settings: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onManageSettingsClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </div>
            );
        }
    }

    private onDialFormSubmit = (ev: SyntheticEvent): void => {
        ev.preventDefault();
        this.transferCall();
    };

    private onDialChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ dialPadValue: ev.currentTarget.value });
    };

    private onDigitPress = (digit: string, ev: ButtonEvent): void => {
        this.setState({ dialPadValue: this.state.dialPadValue + digit });

        // Keep the number field focused so that keyboard entry is still available
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    private onDeletePress = (ev: ButtonEvent): void => {
        if (this.state.dialPadValue.length === 0) return;
        this.setState({ dialPadValue: this.state.dialPadValue.slice(0, -1) });

        // Keep the number field focused so that keyboard entry is still available
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    private onTabChange = (tabId: TabId): void => {
        this.setState({ currentTabId: tabId });
    };

    private async onLinkClick(e: React.MouseEvent<HTMLAnchorElement>): Promise<void> {
        e.preventDefault();
        selectText(e.currentTarget);
    }

    private get screenName(): ScreenName | undefined {
        switch (this.props.kind) {
            case InviteKind.Dm:
                return "StartChat";
            default:
                return undefined;
        }
    }

    /**
     * If encryption by default is enabled, third-party invites should be encrypted as well.
     * For encryption to work, the other side requires a device.
     * To achieve this Element implements a waiting room until all have joined.
     * Waiting for many users degrades the UX → only one email invite is allowed at a time.
     *
     * @param targets - Optional member list to check. Uses targets from state if not provided.
     */
    private canInviteMore(targets?: (Member | RoomMember)[]): boolean {
        targets = targets || this.state.targets;
        return this.canInviteThirdParty(targets) || !targets.some((t) => t instanceof ThreepidMember);
    }

    /**
     * A third-party invite is possible if
     * - this is a non-DM dialog or
     * - there are no invites yet or
     * - encryption by default is not enabled
     *
     * Also see {@link InviteDialog#canInviteMore}.
     *
     * @param targets - Optional member list to check. Uses targets from state if not provided.
     */
    private canInviteThirdParty(targets?: (Member | RoomMember)[]): boolean {
        targets = targets || this.state.targets;
        return this.props.kind !== InviteKind.Dm || targets.length === 0 || !this.encryptionByDefault;
    }

    private hasFilterAtLeastOneEmail(): boolean {
        if (!this.state.filterText) return false;

        return this.parseFilter(this.state.filterText).some((address: string) => {
            return Email.looksValid(address);
        });
    }

    public render(): React.ReactNode {
        let spinner: JSX.Element | undefined;
        if (this.state.busy) {
            spinner = <Spinner w={20} h={20} />;
        }

        let title;
        let helpText;
        let buttonText;
        let goButtonFn: (() => Promise<void>) | null = null;
        let consultConnectSection;
        let extraSection;
        let footer;

        const identityServersEnabled = SettingsStore.getValue(UIFeature.IdentityServer);

        const hasSelection =
            this.state.targets.length > 0 || (this.state.filterText && this.state.filterText.includes("@"));

        const cli = MatrixClientPeg.safeGet();
        const userId = cli.getUserId()!;
        if (this.props.kind === InviteKind.Dm) {
            title = _t("space|add_existing_room_space|dm_heading");

            if (identityServersEnabled) {
                helpText = _t(
                    "invite|start_conversation_name_email_mxid_prompt",
                    {},
                    {
                        userId: () => {
                            return (
                                <a href={makeUserPermalink(userId)} rel="noreferrer noopener" target="_blank">
                                    {userId}
                                </a>
                            );
                        },
                    },
                );
            } else {
                helpText = _t(
                    "invite|start_conversation_name_mxid_prompt",
                    {},
                    {
                        userId: () => {
                            return (
                                <a href={makeUserPermalink(userId)} rel="noreferrer noopener" target="_blank">
                                    {userId}
                                </a>
                            );
                        },
                    },
                );
            }

            buttonText = _t("action|go");
            goButtonFn = this.checkProfileAndStartDm;
            extraSection = (
                <div className="mx_InviteDialog_section_hidden_suggestions_disclaimer">
                    <span>{_t("invite|suggestions_disclaimer")}</span>
                    <p>{_t("invite|suggestions_disclaimer_prompt")}</p>
                </div>
            );
            const link = makeUserPermalink(MatrixClientPeg.safeGet().getSafeUserId());
            footer = (
                <div className="mx_InviteDialog_footer">
                    <h3>{_t("invite|send_link_prompt")}</h3>
                    <CopyableText getTextToCopy={() => makeUserPermalink(MatrixClientPeg.safeGet().getSafeUserId())}>
                        <a className="mx_InviteDialog_footer_link" href={link} onClick={this.onLinkClick}>
                            {link}
                        </a>
                    </CopyableText>
                </div>
            );
        } else if (this.props.kind === InviteKind.Invite) {
            const roomId = this.props.roomId;
            const room = MatrixClientPeg.get()?.getRoom(roomId);
            const isSpace = room?.isSpaceRoom();
            title = isSpace
                ? _t("invite|to_space", {
                      spaceName: room?.name || _t("common|unnamed_space"),
                  })
                : _t("invite|to_room", {
                      roomName: room?.name || _t("common|unnamed_room"),
                  });

            let helpTextUntranslated;
            if (isSpace) {
                if (identityServersEnabled) {
                    helpTextUntranslated = _td("invite|name_email_mxid_share_space");
                } else {
                    helpTextUntranslated = _td("invite|name_mxid_share_space");
                }
            } else {
                if (identityServersEnabled) {
                    helpTextUntranslated = _td("invite|name_email_mxid_share_room");
                } else {
                    helpTextUntranslated = _td("invite|name_mxid_share_room");
                }
            }

            helpText = _t(
                helpTextUntranslated,
                {},
                {
                    userId: () => (
                        <a
                            className="mx_InviteDialog_helpText_userId"
                            href={makeUserPermalink(userId)}
                            rel="noreferrer noopener"
                            target="_blank"
                        >
                            {userId}
                        </a>
                    ),
                    a: (sub) => (
                        <a href={makeRoomPermalink(cli, roomId)} rel="noreferrer noopener" target="_blank">
                            {sub}
                        </a>
                    ),
                },
            );

            buttonText = _t("action|invite");
            goButtonFn = this.inviteUsers;
        } else if (this.props.kind === InviteKind.CallTransfer) {
            title = _t("action|transfer");

            consultConnectSection = (
                <div className="mx_InviteDialog_transferConsultConnect">
                    <label>
                        <input type="checkbox" checked={this.state.consultFirst} onChange={this.onConsultFirstChange} />
                        {_t("voip|transfer_consult_first_label")}
                    </label>
                    <AccessibleButton
                        kind="secondary"
                        onClick={this.onCancel}
                        className="mx_InviteDialog_transferConsultConnect_pushRight"
                    >
                        {_t("action|cancel")}
                    </AccessibleButton>
                    <AccessibleButton
                        kind="primary"
                        onClick={this.transferCall}
                        disabled={!hasSelection && this.state.dialPadValue === ""}
                    >
                        {_t("action|transfer")}
                    </AccessibleButton>
                </div>
            );
        }

        const goButton =
            this.props.kind == InviteKind.CallTransfer ? null : (
                <AccessibleButton
                    kind="primary"
                    onClick={goButtonFn}
                    className="mx_InviteDialog_goButton"
                    disabled={this.state.busy || !hasSelection}
                >
                    {buttonText}
                </AccessibleButton>
            );

        let results: React.ReactNode | null = null;
        let onlyOneThreepidNote: React.ReactNode | null = null;

        if (!this.canInviteMore() || (this.hasFilterAtLeastOneEmail() && !this.canInviteThirdParty())) {
            // We are in DM case here, because of the checks in canInviteMore() / canInviteThirdParty().
            onlyOneThreepidNote = <div className="mx_InviteDialog_oneThreepid">{_t("invite|email_limit_one")}</div>;
        } else {
            results = (
                <div className="mx_InviteDialog_userSections">
                    {this.renderSection("recents")}
                    {this.renderSection("suggestions")}
                    {extraSection}
                </div>
            );
        }

        const usersSection = (
            <React.Fragment>
                <p className="mx_InviteDialog_helpText">{helpText}</p>
                <div className="mx_InviteDialog_addressBar">
                    {this.renderEditor()}
                    <div className="mx_InviteDialog_buttonAndSpinner">
                        {goButton}
                        {spinner}
                    </div>
                </div>
                {this.renderIdentityServerWarning()}
                <div className="error">{this.state.errorText}</div>
                {onlyOneThreepidNote}
                {results}
                {footer}
            </React.Fragment>
        );

        let dialogContent;
        if (this.props.kind === InviteKind.CallTransfer) {
            const tabs: NonEmptyArray<Tab<TabId>> = [
                new Tab(
                    TabId.UserDirectory,
                    _td("invite|transfer_user_directory_tab"),
                    "mx_InviteDialog_userDirectoryIcon",
                    usersSection,
                ),
            ];

            const backspaceButton = <DialPadBackspaceButton onBackspacePress={this.onDeletePress} />;

            // Only show the backspace button if the field has content
            let dialPadField;
            if (this.state.dialPadValue.length !== 0) {
                dialPadField = (
                    <Field
                        ref={this.numberEntryFieldRef}
                        className="mx_InviteDialog_dialPadField"
                        id="dialpad_number"
                        value={this.state.dialPadValue}
                        autoFocus={true}
                        onChange={this.onDialChange}
                        postfixComponent={backspaceButton}
                    />
                );
            } else {
                dialPadField = (
                    <Field
                        ref={this.numberEntryFieldRef}
                        className="mx_InviteDialog_dialPadField"
                        id="dialpad_number"
                        value={this.state.dialPadValue}
                        autoFocus={true}
                        onChange={this.onDialChange}
                    />
                );
            }

            const dialPadSection = (
                <div className="mx_InviteDialog_dialPad">
                    <form onSubmit={this.onDialFormSubmit}>{dialPadField}</form>
                    <Dialpad hasDial={false} onDigitPress={this.onDigitPress} onDeletePress={this.onDeletePress} />
                </div>
            );
            tabs.push(
                new Tab(
                    TabId.DialPad,
                    _td("invite|transfer_dial_pad_tab"),
                    "mx_InviteDialog_dialPadIcon",
                    dialPadSection,
                ),
            );
            dialogContent = (
                <React.Fragment>
                    <TabbedView<TabId>
                        tabs={tabs}
                        activeTabId={this.state.currentTabId}
                        tabLocation={TabLocation.TOP}
                        onChange={this.onTabChange}
                    />
                    {consultConnectSection}
                </React.Fragment>
            );
        } else {
            dialogContent = (
                <React.Fragment>
                    {usersSection}
                    {consultConnectSection}
                </React.Fragment>
            );
        }

        return (
            <BaseDialog
                className={classNames({
                    mx_InviteDialog_transfer: this.props.kind === InviteKind.CallTransfer,
                    mx_InviteDialog_other: this.props.kind !== InviteKind.CallTransfer,
                    mx_InviteDialog_hasFooter: !!footer,
                })}
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={title}
                screenName={this.screenName}
            >
                <div className="mx_InviteDialog_content">{dialogContent}</div>
            </BaseDialog>
        );
    }
}
