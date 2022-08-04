/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from 'react';
import classNames from 'classnames';
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { logger } from "matrix-js-sdk/src/logger";

import { Icon as InfoIcon } from "../../../../res/img/element-icons/info.svg";
import { Icon as EmailPillAvatarIcon } from "../../../../res/img/icon-email-pill-avatar.svg";
import { _t, _td } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { makeRoomPermalink, makeUserPermalink } from "../../../utils/permalinks/Permalinks";
import DMRoomMap from "../../../utils/DMRoomMap";
import SdkConfig from "../../../SdkConfig";
import * as Email from "../../../email";
import { getDefaultIdentityServerUrl, setToDefaultIdentityServer } from "../../../utils/IdentityServerUtils";
import { buildActivityScores, buildMemberScores, compareMembers } from "../../../utils/SortMembers";
import { abbreviateUrl } from "../../../utils/UrlUtils";
import IdentityAuthClient from "../../../IdentityAuthClient";
import { humanizeTime } from "../../../utils/humanize";
import {
    IInviteResult,
    inviteMultipleToRoom,
    showAnyInviteErrors,
} from "../../../RoomInvite";
import { Action } from "../../../dispatcher/actions";
import { DefaultTagID } from "../../../stores/room-list/models";
import RoomListStore from "../../../stores/room-list/RoomListStore";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { mediaFromMxc } from "../../../customisations/Media";
import BaseAvatar from '../avatars/BaseAvatar';
import { SearchResultAvatar } from "../avatars/SearchResultAvatar";
import AccessibleButton, { ButtonEvent } from '../elements/AccessibleButton';
import { selectText } from '../../../utils/strings';
import Field from '../elements/Field';
import TabbedView, { Tab, TabLocation } from '../../structures/TabbedView';
import Dialpad from '../voip/DialPad';
import QuestionDialog from "./QuestionDialog";
import Spinner from "../elements/Spinner";
import BaseDialog from "./BaseDialog";
import DialPadBackspaceButton from "../elements/DialPadBackspaceButton";
import CallHandler from "../../../CallHandler";
import UserIdentifierCustomisations from '../../../customisations/UserIdentifier';
import CopyableText from "../elements/CopyableText";
import { ScreenName } from '../../../PosthogTrackers';
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import {
    DirectoryMember,
    IDMUserTileProps,
    Member,
    startDmOnFirstMessage,
    ThreepidMember,
} from "../../../utils/direct-messages";
import { AnyInviteKind, KIND_CALL_TRANSFER, KIND_DM, KIND_INVITE } from './InviteDialogTypes';
import Modal from '../../../Modal';
import dis from "../../../dispatcher/dispatcher";

// we have a number of types defined from the Matrix spec which can't reasonably be altered here.
/* eslint-disable camelcase */

interface IRecentUser {
    userId: string;
    user: RoomMember;
    lastActive: number;
}

const INITIAL_ROOMS_SHOWN = 3; // Number of rooms to show at first
const INCREMENT_ROOMS_SHOWN = 5; // Number of rooms to add when 'show more' is clicked

enum TabId {
    UserDirectory = 'users',
    DialPad = 'dialpad',
}

class DMUserTile extends React.PureComponent<IDMUserTileProps> {
    private onRemove = (e) => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        this.props.onRemove(this.props.member);
    };

    render() {
        const avatarSize = 20;
        const avatar = <SearchResultAvatar user={this.props.member} size={avatarSize} />;

        let closeButton;
        if (this.props.onRemove) {
            closeButton = (
                <AccessibleButton
                    className='mx_InviteDialog_userTile_remove'
                    onClick={this.onRemove}
                >
                    <img
                        src={require("../../../../res/img/icon-pill-remove.svg").default}
                        alt={_t('Remove')}
                        width={8}
                        height={8}
                    />
                </AccessibleButton>
            );
        }

        return (
            <span className='mx_InviteDialog_userTile'>
                <span className='mx_InviteDialog_userTile_pill'>
                    { avatar }
                    <span className='mx_InviteDialog_userTile_name'>{ this.props.member.name }</span>
                </span>
                { closeButton }
            </span>
        );
    }
}

interface IDMRoomTileProps {
    member: Member;
    lastActiveTs: number;
    onToggle(member: Member): void;
    highlightWord: string;
    isSelected: boolean;
}

class DMRoomTile extends React.PureComponent<IDMRoomTileProps> {
    private onClick = (e) => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        this.props.onToggle(this.props.member);
    };

    private highlightName(str: string) {
        if (!this.props.highlightWord) return str;

        // We convert things to lowercase for index searching, but pull substrings from
        // the submitted text to preserve case. Note: we don't need to htmlEntities the
        // string because React will safely encode the text for us.
        const lowerStr = str.toLowerCase();
        const filterStr = this.props.highlightWord.toLowerCase();

        const result = [];

        let i = 0;
        let ii;
        while ((ii = lowerStr.indexOf(filterStr, i)) >= 0) {
            // Push any text we missed (first bit/middle of text)
            if (ii > i) {
                // Push any text we aren't highlighting (middle of text match, or beginning of text)
                result.push(<span key={i + 'begin'}>{ str.substring(i, ii) }</span>);
            }

            i = ii; // copy over ii only if we have a match (to preserve i for end-of-text matching)

            // Highlight the word the user entered
            const substr = str.substring(i, filterStr.length + i);
            result.push(<span className='mx_InviteDialog_tile--room_highlight' key={i + 'bold'}>{ substr }</span>);
            i += substr.length;
        }

        // Push any text we missed (end of text)
        if (i < str.length) {
            result.push(<span key={i + 'end'}>{ str.substring(i) }</span>);
        }

        return result;
    }

    render() {
        let timestamp = null;
        if (this.props.lastActiveTs) {
            const humanTs = humanizeTime(this.props.lastActiveTs);
            timestamp = <span className='mx_InviteDialog_tile--room_time'>{ humanTs }</span>;
        }

        const avatarSize = 36;
        const avatar = (this.props.member as ThreepidMember).isEmail
            ? <EmailPillAvatarIcon
                width={avatarSize}
                height={avatarSize}
            />
            : <BaseAvatar
                url={this.props.member.getMxcAvatarUrl()
                    ? mediaFromMxc(this.props.member.getMxcAvatarUrl()).getSquareThumbnailHttp(avatarSize)
                    : null}
                name={this.props.member.name}
                idName={this.props.member.userId}
                width={avatarSize}
                height={avatarSize} />;

        let checkmark = null;
        if (this.props.isSelected) {
            // To reduce flickering we put the 'selected' room tile above the real avatar
            checkmark = <div className='mx_InviteDialog_tile--room_selected' />;
        }

        // To reduce flickering we put the checkmark on top of the actual avatar (prevents
        // the browser from reloading the image source when the avatar remounts).
        const stackedAvatar = (
            <span className='mx_InviteDialog_tile_avatarStack'>
                { avatar }
                { checkmark }
            </span>
        );

        const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier(
            this.props.member.userId, { withDisplayName: true },
        );

        const caption = (this.props.member as ThreepidMember).isEmail
            ? _t("Invite by email")
            : this.highlightName(userIdentifier);

        return (
            <div className='mx_InviteDialog_tile mx_InviteDialog_tile--room' onClick={this.onClick}>
                { stackedAvatar }
                <span className="mx_InviteDialog_tile_nameStack">
                    <div className='mx_InviteDialog_tile_nameStack_name'>{ this.highlightName(this.props.member.name) }</div>
                    <div className='mx_InviteDialog_tile_nameStack_userId'>{ caption }</div>
                </span>
                { timestamp }
            </div>
        );
    }
}

interface IInviteDialogProps {
    // Takes a boolean which is true if a user / users were invited /
    // a call transfer was initiated or false if the dialog was cancelled
    // with no action taken.
    onFinished: (success: boolean) => void;

    // The kind of invite being performed. Assumed to be KIND_DM if
    // not provided.
    kind: AnyInviteKind;

    // The room ID this dialog is for. Only required for KIND_INVITE.
    roomId: string;

    // The call to transfer. Only required for KIND_CALL_TRANSFER.
    call: MatrixCall;

    // Initial value to populate the filter with
    initialText: string;
}

interface IInviteDialogState {
    targets: Member[]; // array of Member objects (see interface above)
    filterText: string;
    recents: { user: Member, userId: string }[];
    numRecentsShown: number;
    suggestions: { user: Member, userId: string }[];
    numSuggestionsShown: number;
    serverResultsMixin: { user: Member, userId: string }[];
    threepidResultsMixin: { user: Member, userId: string}[];
    canUseIdentityServer: boolean;
    tryingIdentityServer: boolean;
    consultFirst: boolean;
    dialPadValue: string;
    currentTabId: TabId;

    // These two flags are used for the 'Go' button to communicate what is going on.
    busy: boolean;
    errorText: string;
}

export default class InviteDialog extends React.PureComponent<IInviteDialogProps, IInviteDialogState> {
    static defaultProps = {
        kind: KIND_DM,
        initialText: "",
    };

    private closeCopiedTooltip: () => void;
    private debounceTimer: number = null; // actually number because we're in the browser
    private editorRef = createRef<HTMLInputElement>();
    private numberEntryFieldRef: React.RefObject<Field> = createRef();
    private unmounted = false;

    constructor(props) {
        super(props);

        if ((props.kind === KIND_INVITE) && !props.roomId) {
            throw new Error("When using KIND_INVITE a roomId is required for an InviteDialog");
        } else if (props.kind === KIND_CALL_TRANSFER && !props.call) {
            throw new Error("When using KIND_CALL_TRANSFER a call is required for an InviteDialog");
        }

        const alreadyInvited = new Set([MatrixClientPeg.get().getUserId(), SdkConfig.get("welcome_user_id")]);
        if (props.roomId) {
            const room = MatrixClientPeg.get().getRoom(props.roomId);
            if (!room) throw new Error("Room ID given to InviteDialog does not look like a room");
            room.getMembersWithMembership('invite').forEach(m => alreadyInvited.add(m.userId));
            room.getMembersWithMembership('join').forEach(m => alreadyInvited.add(m.userId));
            // add banned users, so we don't try to invite them
            room.getMembersWithMembership('ban').forEach(m => alreadyInvited.add(m.userId));
        }

        this.state = {
            targets: [], // array of Member objects (see interface above)
            filterText: this.props.initialText,
            recents: InviteDialog.buildRecents(alreadyInvited),
            numRecentsShown: INITIAL_ROOMS_SHOWN,
            suggestions: this.buildSuggestions(alreadyInvited),
            numSuggestionsShown: INITIAL_ROOMS_SHOWN,
            serverResultsMixin: [],
            threepidResultsMixin: [],
            canUseIdentityServer: !!MatrixClientPeg.get().getIdentityServerUrl(),
            tryingIdentityServer: false,
            consultFirst: false,
            dialPadValue: '',
            currentTabId: TabId.UserDirectory,

            // These two flags are used for the 'Go' button to communicate what is going on.
            busy: false,
            errorText: null,
        };
    }

    componentDidMount() {
        if (this.props.initialText) {
            this.updateSuggestions(this.props.initialText);
        }
    }

    componentWillUnmount() {
        this.unmounted = true;
        // if the Copied tooltip is open then get rid of it, there are ways to close the modal which wouldn't close
        // the tooltip otherwise, such as pressing Escape or clicking X really quickly
        if (this.closeCopiedTooltip) this.closeCopiedTooltip();
    }

    private onConsultFirstChange = (ev) => {
        this.setState({ consultFirst: ev.target.checked });
    };

    public static buildRecents(excludedTargetIds: Set<string>): IRecentUser[] {
        const rooms = DMRoomMap.shared().getUniqueRoomsWithIndividuals(); // map of userId => js-sdk Room

        // Also pull in all the rooms tagged as DefaultTagID.DM so we don't miss anything. Sometimes the
        // room list doesn't tag the room for the DMRoomMap, but does for the room list.
        const dmTaggedRooms = RoomListStore.instance.orderedLists[DefaultTagID.DM] || [];
        const myUserId = MatrixClientPeg.get().getUserId();
        for (const dmRoom of dmTaggedRooms) {
            const otherMembers = dmRoom.getJoinedMembers().filter(u => u.userId !== myUserId);
            for (const member of otherMembers) {
                if (rooms[member.userId]) continue; // already have a room

                logger.warn(`Adding DM room for ${member.userId} as ${dmRoom.roomId} from tag, not DM map`);
                rooms[member.userId] = dmRoom;
            }
        }

        const recents = [];
        for (const userId in rooms) {
            // Filter out user IDs that are already in the room / should be excluded
            if (excludedTargetIds.has(userId)) {
                logger.warn(`[Invite:Recents] Excluding ${userId} from recents`);
                continue;
            }

            const room = rooms[userId];
            const member = room.getMember(userId);
            if (!member) {
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

            recents.push({ userId, user: member, lastActive: lastEventTs });
        }
        if (!recents) logger.warn("[Invite:Recents] No recents to suggest!");

        // Sort the recents by last active to save us time later
        recents.sort((a, b) => b.lastActive - a.lastActive);

        return recents;
    }

    private buildSuggestions(excludedTargetIds: Set<string>): {userId: string, user: RoomMember}[] {
        const cli = MatrixClientPeg.get();
        const activityScores = buildActivityScores(cli);
        const memberScores = buildMemberScores(cli);
        const memberComparator = compareMembers(activityScores, memberScores);

        return Object.values(memberScores).map(({ member }) => member)
            .filter(member => !excludedTargetIds.has(member.userId))
            .sort(memberComparator)
            .map(member => ({ userId: member.userId, user: member }));
    }

    private shouldAbortAfterInviteError(result: IInviteResult, room: Room): boolean {
        this.setState({ busy: false });
        const userMap = new Map<string, Member>(this.state.targets.map(member => [member.userId, member]));
        return !showAnyInviteErrors(result.states, room, result.inviter, userMap);
    }

    private convertFilter(): Member[] {
        // Check to see if there's anything to convert first
        if (!this.state.filterText || !this.state.filterText.includes('@')) return this.state.targets || [];

        let newMember: Member;
        if (this.state.filterText.startsWith('@')) {
            // Assume mxid
            newMember = new DirectoryMember({ user_id: this.state.filterText, display_name: null, avatar_url: null });
        } else if (SettingsStore.getValue(UIFeature.IdentityServer)) {
            // Assume email
            newMember = new ThreepidMember(this.state.filterText);
        }
        const newTargets = [...(this.state.targets || []), newMember];
        this.setState({ targets: newTargets, filterText: '' });
        return newTargets;
    }

    private startDm = async () => {
        try {
            const cli = MatrixClientPeg.get();
            const targets = this.convertFilter();
            startDmOnFirstMessage(cli, targets);
            this.props.onFinished(true);
        } catch (err) {
            logger.error(err);
            this.setState({
                busy: false,
                errorText: _t("We couldn't create your DM."),
            });
        }
    };

    private inviteUsers = async () => {
        this.setState({ busy: true });
        this.convertFilter();
        const targets = this.convertFilter();
        const targetIds = targets.map(t => t.userId);

        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.roomId);
        if (!room) {
            logger.error("Failed to find the room to invite users to");
            this.setState({
                busy: false,
                errorText: _t("Something went wrong trying to invite the users."),
            });
            return;
        }

        try {
            const result = await inviteMultipleToRoom(this.props.roomId, targetIds, true);
            if (!this.shouldAbortAfterInviteError(result, room)) { // handles setting error message too
                this.props.onFinished(true);
            }
        } catch (err) {
            logger.error(err);
            this.setState({
                busy: false,
                errorText: _t(
                    "We couldn't invite those users. Please check the users you want to invite and try again.",
                ),
            });
        }
    };

    private transferCall = async () => {
        if (this.state.currentTabId == TabId.UserDirectory) {
            this.convertFilter();
            const targets = this.convertFilter();
            const targetIds = targets.map(t => t.userId);
            if (targetIds.length > 1) {
                this.setState({
                    errorText: _t("A call can only be transferred to a single user."),
                });
                return;
            }

            CallHandler.instance.startTransferToMatrixID(
                this.props.call,
                targetIds[0],
                this.state.consultFirst,
            );
        } else {
            CallHandler.instance.startTransferToPhoneNumber(
                this.props.call,
                this.state.dialPadValue,
                this.state.consultFirst,
            );
        }
        this.props.onFinished(true);
    };

    private onKeyDown = (e) => {
        if (this.state.busy) return;

        let handled = false;
        const value = e.target.value.trim();
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

    private onCancel = () => {
        this.props.onFinished(false);
    };

    private updateSuggestions = async (term) => {
        MatrixClientPeg.get().searchUserDirectory({ term }).then(async r => {
            if (term !== this.state.filterText) {
                // Discard the results - we were probably too slow on the server-side to make
                // these results useful. This is a race we want to avoid because we could overwrite
                // more accurate results.
                return;
            }

            if (!r.results) r.results = [];

            // While we're here, try and autocomplete a search result for the mxid itself
            // if there's no matches (and the input looks like a mxid).
            if (term[0] === '@' && term.indexOf(':') > 1) {
                try {
                    const profile = await MatrixClientPeg.get().getProfileInfo(term);
                    if (profile) {
                        // If we have a profile, we have enough information to assume that
                        // the mxid can be invited - add it to the list. We stick it at the
                        // top so it is most obviously presented to the user.
                        r.results.splice(0, 0, {
                            user_id: term,
                            display_name: profile['displayname'],
                            avatar_url: profile['avatar_url'],
                        });
                    }
                } catch (e) {
                    logger.warn("Non-fatal error trying to make an invite for a user ID");
                    logger.warn(e);

                    // Add a result anyways, just without a profile. We stick it at the
                    // top so it is most obviously presented to the user.
                    r.results.splice(0, 0, {
                        user_id: term,
                        display_name: term,
                        avatar_url: null,
                    });
                }
            }

            this.setState({
                serverResultsMixin: r.results.map(u => ({
                    userId: u.user_id,
                    user: new DirectoryMember(u),
                })),
            });
        }).catch(e => {
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
        if (term.indexOf('@') > 0 && Email.looksValid(term) && SettingsStore.getValue(UIFeature.IdentityServer)) {
            // Start off by suggesting the plain email while we try and resolve it
            // to a real account.
            this.setState({
                // per above: the userId is a lie here - it's just a regular identifier
                threepidResultsMixin: [{ user: new ThreepidMember(term), userId: term }],
            });
            try {
                const authClient = new IdentityAuthClient();
                const token = await authClient.getAccessToken();
                if (term !== this.state.filterText) return; // abandon hope

                const lookup = await MatrixClientPeg.get().lookupThreePid(
                    'email',
                    term,
                    undefined, // callback
                    token,
                );
                if (term !== this.state.filterText) return; // abandon hope

                if (!lookup || !lookup.mxid) {
                    // We weren't able to find anyone - we're already suggesting the plain email
                    // as an alternative, so do nothing.
                    return;
                }

                // We append the user suggestion to give the user an option to click
                // the email anyways, and so we don't cause things to jump around. In
                // theory, the user would see the user pop up and think "ah yes, that
                // person!"
                const profile = await MatrixClientPeg.get().getProfileInfo(lookup.mxid);
                if (term !== this.state.filterText || !profile) return; // abandon hope
                this.setState({
                    threepidResultsMixin: [...this.state.threepidResultsMixin, {
                        user: new DirectoryMember({
                            user_id: lookup.mxid,
                            display_name: profile.displayname,
                            avatar_url: profile.avatar_url,
                        }),
                        userId: lookup.mxid,
                    }],
                });
            } catch (e) {
                logger.error("Error searching identity server:");
                logger.error(e);
                this.setState({ threepidResultsMixin: [] }); // clear results because it's moderately fatal
            }
        }
    };

    private updateFilter = (e) => {
        const term = e.target.value;
        this.setState({ filterText: term });

        // Debounce server lookups to reduce spam. We don't clear the existing server
        // results because they might still be vaguely accurate, likewise for races which
        // could happen here.
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.updateSuggestions(term);
        }, 150); // 150ms debounce (human reaction time + some)
    };

    private showMoreRecents = () => {
        this.setState({ numRecentsShown: this.state.numRecentsShown + INCREMENT_ROOMS_SHOWN });
    };

    private showMoreSuggestions = () => {
        this.setState({ numSuggestionsShown: this.state.numSuggestionsShown + INCREMENT_ROOMS_SHOWN });
    };

    private toggleMember = (member: Member) => {
        if (!this.state.busy) {
            let filterText = this.state.filterText;
            let targets = this.state.targets.map(t => t); // cheap clone for mutation
            const idx = targets.indexOf(member);
            if (idx >= 0) {
                targets.splice(idx, 1);
            } else {
                if (this.props.kind === KIND_CALL_TRANSFER && targets.length > 0) {
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

    private removeMember = (member: Member) => {
        const targets = this.state.targets.map(t => t); // cheap clone for mutation
        const idx = targets.indexOf(member);
        if (idx >= 0) {
            targets.splice(idx, 1);
            this.setState({ targets });
        }

        if (this.editorRef && this.editorRef.current) {
            this.editorRef.current.focus();
        }
    };

    private onPaste = async (e) => {
        if (this.state.filterText) {
            // if the user has already typed something, just let them
            // paste normally.
            return;
        }

        // Prevent the text being pasted into the input
        e.preventDefault();

        // Process it as a list of addresses to add instead
        const text = e.clipboardData.getData("text");
        const possibleMembers = [
            // If we can avoid hitting the profile endpoint, we should.
            ...this.state.recents,
            ...this.state.suggestions,
            ...this.state.serverResultsMixin,
            ...this.state.threepidResultsMixin,
        ];
        const toAdd = [];
        const failed = [];
        const potentialAddresses = text.split(/[\s,]+/).map(p => p.trim()).filter(p => !!p); // filter empty strings
        for (const address of potentialAddresses) {
            const member = possibleMembers.find(m => m.userId === address);
            if (member) {
                toAdd.push(member.user);
                continue;
            }

            if (address.indexOf('@') > 0 && Email.looksValid(address)) {
                toAdd.push(new ThreepidMember(address));
                continue;
            }

            if (address[0] !== '@') {
                failed.push(address); // not a user ID
                continue;
            }

            try {
                const profile = await MatrixClientPeg.get().getProfileInfo(address);
                const displayName = profile ? profile.displayname : null;
                const avatarUrl = profile ? profile.avatar_url : null;
                toAdd.push(new DirectoryMember({
                    user_id: address,
                    display_name: displayName,
                    avatar_url: avatarUrl,
                }));
            } catch (e) {
                logger.error("Error looking up profile for " + address);
                logger.error(e);
                failed.push(address);
            }
        }
        if (this.unmounted) return;

        if (failed.length > 0) {
            Modal.createDialog(QuestionDialog, {
                title: _t('Failed to find the following users'),
                description: _t(
                    "The following users might not exist or are invalid, and cannot be invited: %(csvNames)s",
                    { csvNames: failed.join(", ") },
                ),
                button: _t('OK'),
            });
        }

        this.setState({ targets: [...this.state.targets, ...toAdd] });
    };

    private onClickInputArea = (e) => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        if (this.editorRef && this.editorRef.current) {
            this.editorRef.current.focus();
        }
    };

    private onUseDefaultIdentityServerClick = (e) => {
        e.preventDefault();

        // Update the IS in account data. Actually using it may trigger terms.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        setToDefaultIdentityServer();
        this.setState({ canUseIdentityServer: true, tryingIdentityServer: false });
    };

    private onManageSettingsClick = (e) => {
        e.preventDefault();
        dis.fire(Action.ViewUserSettings);
        this.props.onFinished(false);
    };

    private renderSection(kind: "recents"|"suggestions") {
        let sourceMembers = kind === 'recents' ? this.state.recents : this.state.suggestions;
        let showNum = kind === 'recents' ? this.state.numRecentsShown : this.state.numSuggestionsShown;
        const showMoreFn = kind === 'recents' ? this.showMoreRecents.bind(this) : this.showMoreSuggestions.bind(this);
        const lastActive = (m) => kind === 'recents' ? m.lastActive : null;
        let sectionName = kind === 'recents' ? _t("Recent Conversations") : _t("Suggestions");

        if (this.props.kind === KIND_INVITE) {
            sectionName = kind === 'recents' ? _t("Recently Direct Messaged") : _t("Suggestions");
        }

        // Mix in the server results if we have any, but only if we're searching. We track the additional
        // members separately because we want to filter sourceMembers but trust the mixin arrays to have
        // the right members in them.
        let priorityAdditionalMembers = []; // Shows up before our own suggestions, higher quality
        let otherAdditionalMembers = []; // Shows up after our own suggestions, lower quality
        const hasMixins = this.state.serverResultsMixin || this.state.threepidResultsMixin;
        if (this.state.filterText && hasMixins && kind === 'suggestions') {
            // We don't want to duplicate members though, so just exclude anyone we've already seen.
            // The type of u is a pain to define but members of both mixins have the 'userId' property
            const notAlreadyExists = (u: any): boolean => {
                return !sourceMembers.some(m => m.userId === u.userId)
                    && !priorityAdditionalMembers.some(m => m.userId === u.userId)
                    && !otherAdditionalMembers.some(m => m.userId === u.userId);
            };

            otherAdditionalMembers = this.state.serverResultsMixin.filter(notAlreadyExists);
            priorityAdditionalMembers = this.state.threepidResultsMixin.filter(notAlreadyExists);
        }
        const hasAdditionalMembers = priorityAdditionalMembers.length > 0 || otherAdditionalMembers.length > 0;

        // Hide the section if there's nothing to filter by
        if (sourceMembers.length === 0 && !hasAdditionalMembers) return null;

        // Do some simple filtering on the input before going much further. If we get no results, say so.
        if (this.state.filterText) {
            const filterBy = this.state.filterText.toLowerCase();
            sourceMembers = sourceMembers
                .filter(m => m.user.name.toLowerCase().includes(filterBy) || m.userId.toLowerCase().includes(filterBy));

            if (sourceMembers.length === 0 && !hasAdditionalMembers) {
                return (
                    <div className='mx_InviteDialog_section'>
                        <h3>{ sectionName }</h3>
                        <p>{ _t("No results") }</p>
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

        let showMore = null;
        if (hasMore) {
            showMore = (
                <div className="mx_InviteDialog_section_showMore">
                    <AccessibleButton onClick={showMoreFn} kind="link">
                        { _t("Show more") }
                    </AccessibleButton>
                </div>
            );
        }

        const tiles = toRender.map(r => (
            <DMRoomTile
                member={r.user}
                lastActiveTs={lastActive(r)}
                key={r.userId}
                onToggle={this.toggleMember}
                highlightWord={this.state.filterText}
                isSelected={this.state.targets.some(t => t.userId === r.userId)}
            />
        ));
        return (
            <div className='mx_InviteDialog_section'>
                <h3>{ sectionName }</h3>
                { tiles }
                { showMore }
            </div>
        );
    }

    private renderEditor() {
        const hasPlaceholder = (
            this.props.kind == KIND_CALL_TRANSFER &&
            this.state.targets.length === 0 &&
            this.state.filterText.length === 0
        );
        const targets = this.state.targets.map(t => (
            <DMUserTile member={t} onRemove={!this.state.busy && this.removeMember} key={t.userId} />
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
                disabled={this.state.busy || (this.props.kind == KIND_CALL_TRANSFER && this.state.targets.length > 0)}
                autoComplete="off"
                placeholder={hasPlaceholder ? _t("Search") : null}
                data-test-id="invite-dialog-input"
            />
        );
        return (
            <div className='mx_InviteDialog_editor' onClick={this.onClickInputArea}>
                { targets }
                { input }
            </div>
        );
    }

    private renderIdentityServerWarning() {
        if (!this.state.tryingIdentityServer || this.state.canUseIdentityServer ||
            !SettingsStore.getValue(UIFeature.IdentityServer)
        ) {
            return null;
        }

        const defaultIdentityServerUrl = getDefaultIdentityServerUrl();
        if (defaultIdentityServerUrl) {
            return (
                <div className="mx_InviteDialog_identityServer">{ _t(
                    "Use an identity server to invite by email. " +
                    "<default>Use the default (%(defaultIdentityServerName)s)</default> " +
                    "or manage in <settings>Settings</settings>.",
                    {
                        defaultIdentityServerName: abbreviateUrl(defaultIdentityServerUrl),
                    },
                    {
                        default: sub =>
                            <AccessibleButton kind='link_inline' onClick={this.onUseDefaultIdentityServerClick}>
                                { sub }
                            </AccessibleButton>,
                        settings: sub =>
                            <AccessibleButton kind='link_inline' onClick={this.onManageSettingsClick}>
                                { sub }
                            </AccessibleButton>,
                    },
                ) }</div>
            );
        } else {
            return (
                <div className="mx_InviteDialog_identityServer">{ _t(
                    "Use an identity server to invite by email. " +
                    "Manage in <settings>Settings</settings>.",
                    {}, {
                        settings: sub =>
                            <AccessibleButton kind='link_inline' onClick={this.onManageSettingsClick}>
                                { sub }
                            </AccessibleButton>,
                    },
                ) }</div>
            );
        }
    }

    private onDialFormSubmit = ev => {
        ev.preventDefault();
        this.transferCall();
    };

    private onDialChange = ev => {
        this.setState({ dialPadValue: ev.currentTarget.value });
    };

    private onDigitPress = (digit: string, ev: ButtonEvent) => {
        this.setState({ dialPadValue: this.state.dialPadValue + digit });

        // Keep the number field focused so that keyboard entry is still available
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    private onDeletePress = (ev: ButtonEvent) => {
        if (this.state.dialPadValue.length === 0) return;
        this.setState({ dialPadValue: this.state.dialPadValue.slice(0, -1) });

        // Keep the number field focused so that keyboard entry is still available
        // However, don't focus if this wasn't the result of directly clicking on the button,
        // i.e someone using keyboard navigation.
        if (ev.type === "click") {
            this.numberEntryFieldRef.current?.focus();
        }
    };

    private onTabChange = (tabId: TabId) => {
        this.setState({ currentTabId: tabId });
    };

    private async onLinkClick(e) {
        e.preventDefault();
        selectText(e.target);
    }

    private get screenName(): ScreenName {
        switch (this.props.kind) {
            case KIND_DM:
                return "StartChat";
        }
    }

    render() {
        let spinner = null;
        if (this.state.busy) {
            spinner = <Spinner w={20} h={20} />;
        }

        let title;
        let helpText;
        let buttonText;
        let goButtonFn;
        let consultConnectSection;
        let extraSection;
        let footer;
        let keySharingWarning = <span />;

        const identityServersEnabled = SettingsStore.getValue(UIFeature.IdentityServer);

        const hasSelection = this.state.targets.length > 0
            || (this.state.filterText && this.state.filterText.includes('@'));

        const cli = MatrixClientPeg.get();
        const userId = cli.getUserId();
        if (this.props.kind === KIND_DM) {
            title = _t("Direct Messages");

            if (identityServersEnabled) {
                helpText = _t(
                    "Start a conversation with someone using their name, email address or username (like <userId/>).",
                    {},
                    { userId: () => {
                        return (
                            <a href={makeUserPermalink(userId)} rel="noreferrer noopener" target="_blank">{ userId }</a>
                        );
                    } },
                );
            } else {
                helpText = _t(
                    "Start a conversation with someone using their name or username (like <userId/>).",
                    {},
                    { userId: () => {
                        return (
                            <a href={makeUserPermalink(userId)} rel="noreferrer noopener" target="_blank">{ userId }</a>
                        );
                    } },
                );
            }

            buttonText = _t("Go");
            goButtonFn = this.startDm;
            extraSection = <div className="mx_InviteDialog_section_hidden_suggestions_disclaimer">
                <span>{ _t("Some suggestions may be hidden for privacy.") }</span>
                <p>{ _t("If you can't see who you're looking for, send them your invite link below.") }</p>
            </div>;
            const link = makeUserPermalink(MatrixClientPeg.get().getUserId());
            footer = <div className="mx_InviteDialog_footer">
                <h3>{ _t("Or send invite link") }</h3>
                <CopyableText getTextToCopy={() => makeUserPermalink(MatrixClientPeg.get().getUserId())}>
                    <a href={link} onClick={this.onLinkClick}>
                        { link }
                    </a>
                </CopyableText>
            </div>;
        } else if (this.props.kind === KIND_INVITE) {
            const room = MatrixClientPeg.get()?.getRoom(this.props.roomId);
            const isSpace = room?.isSpaceRoom();
            title = isSpace
                ? _t("Invite to %(spaceName)s", {
                    spaceName: room.name || _t("Unnamed Space"),
                })
                : _t("Invite to %(roomName)s", {
                    roomName: room.name || _t("Unnamed Room"),
                });

            let helpTextUntranslated;
            if (isSpace) {
                if (identityServersEnabled) {
                    helpTextUntranslated = _td("Invite someone using their name, email address, username " +
                        "(like <userId/>) or <a>share this space</a>.");
                } else {
                    helpTextUntranslated = _td("Invite someone using their name, username " +
                        "(like <userId/>) or <a>share this space</a>.");
                }
            } else {
                if (identityServersEnabled) {
                    helpTextUntranslated = _td("Invite someone using their name, email address, username " +
                        "(like <userId/>) or <a>share this room</a>.");
                } else {
                    helpTextUntranslated = _td("Invite someone using their name, username " +
                        "(like <userId/>) or <a>share this room</a>.");
                }
            }

            helpText = _t(helpTextUntranslated, {}, {
                userId: () =>
                    <a href={makeUserPermalink(userId)} rel="noreferrer noopener" target="_blank">{ userId }</a>,
                a: (sub) =>
                    <a href={makeRoomPermalink(this.props.roomId)} rel="noreferrer noopener" target="_blank">{ sub }</a>,
            });

            buttonText = _t("Invite");
            goButtonFn = this.inviteUsers;

            if (cli.isRoomEncrypted(this.props.roomId)) {
                const room = cli.getRoom(this.props.roomId);
                const visibilityEvent = room.currentState.getStateEvents(
                    "m.room.history_visibility", "",
                );
                const visibility = visibilityEvent && visibilityEvent.getContent() &&
                    visibilityEvent.getContent().history_visibility;
                if (visibility === "world_readable" || visibility === "shared") {
                    keySharingWarning =
                        <p className='mx_InviteDialog_helpText'>
                            <InfoIcon height={14} width={14} />
                            { " " + _t("Invited people will be able to read old messages.") }
                        </p>;
                }
            }
        } else if (this.props.kind === KIND_CALL_TRANSFER) {
            title = _t("Transfer");

            consultConnectSection = <div className="mx_InviteDialog_transferConsultConnect">
                <label>
                    <input type="checkbox" checked={this.state.consultFirst} onChange={this.onConsultFirstChange} />
                    { _t("Consult first") }
                </label>
                <AccessibleButton
                    kind="secondary"
                    onClick={this.onCancel}
                    className='mx_InviteDialog_transferConsultConnect_pushRight'
                >
                    { _t("Cancel") }
                </AccessibleButton>
                <AccessibleButton
                    kind="primary"
                    onClick={this.transferCall}
                    className='mx_InviteDialog_transferButton'
                    disabled={!hasSelection && this.state.dialPadValue === ''}
                >
                    { _t("Transfer") }
                </AccessibleButton>
            </div>;
        } else {
            logger.error("Unknown kind of InviteDialog: " + this.props.kind);
        }

        const goButton = this.props.kind == KIND_CALL_TRANSFER ? null : <AccessibleButton
            kind="primary"
            onClick={goButtonFn}
            className='mx_InviteDialog_goButton'
            disabled={this.state.busy || !hasSelection}
        >
            { buttonText }
        </AccessibleButton>;

        const usersSection = <React.Fragment>
            <p className='mx_InviteDialog_helpText'>{ helpText }</p>
            <div className='mx_InviteDialog_addressBar'>
                { this.renderEditor() }
                <div className='mx_InviteDialog_buttonAndSpinner'>
                    { goButton }
                    { spinner }
                </div>
            </div>
            { keySharingWarning }
            { this.renderIdentityServerWarning() }
            <div className='error'>{ this.state.errorText }</div>
            <div className='mx_InviteDialog_userSections'>
                { this.renderSection('recents') }
                { this.renderSection('suggestions') }
                { extraSection }
            </div>
            { footer }
        </React.Fragment>;

        let dialogContent;
        if (this.props.kind === KIND_CALL_TRANSFER) {
            const tabs = [];
            tabs.push(new Tab(
                TabId.UserDirectory, _td("User Directory"), 'mx_InviteDialog_userDirectoryIcon', usersSection,
            ));

            const backspaceButton = (
                <DialPadBackspaceButton onBackspacePress={this.onDeletePress} />
            );

            // Only show the backspace button if the field has content
            let dialPadField;
            if (this.state.dialPadValue.length !== 0) {
                dialPadField = <Field
                    ref={this.numberEntryFieldRef}
                    className="mx_InviteDialog_dialPadField"
                    id="dialpad_number"
                    value={this.state.dialPadValue}
                    autoFocus={true}
                    onChange={this.onDialChange}
                    postfixComponent={backspaceButton}
                />;
            } else {
                dialPadField = <Field
                    ref={this.numberEntryFieldRef}
                    className="mx_InviteDialog_dialPadField"
                    id="dialpad_number"
                    value={this.state.dialPadValue}
                    autoFocus={true}
                    onChange={this.onDialChange}
                />;
            }

            const dialPadSection = <div className="mx_InviteDialog_dialPad">
                <form onSubmit={this.onDialFormSubmit}>
                    { dialPadField }
                </form>
                <Dialpad
                    hasDial={false}
                    onDigitPress={this.onDigitPress}
                    onDeletePress={this.onDeletePress}
                />
            </div>;
            tabs.push(new Tab(TabId.DialPad, _td("Dial pad"), 'mx_InviteDialog_dialPadIcon', dialPadSection));
            dialogContent = <React.Fragment>
                <TabbedView
                    tabs={tabs}
                    initialTabId={this.state.currentTabId}
                    tabLocation={TabLocation.TOP}
                    onChange={this.onTabChange}
                />
                { consultConnectSection }
            </React.Fragment>;
        } else {
            dialogContent = <React.Fragment>
                { usersSection }
                { consultConnectSection }
            </React.Fragment>;
        }

        return (
            <BaseDialog
                className={classNames({
                    mx_InviteDialog_transfer: this.props.kind === KIND_CALL_TRANSFER,
                    mx_InviteDialog_other: this.props.kind !== KIND_CALL_TRANSFER,
                    mx_InviteDialog_hasFooter: !!footer,
                })}
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={title}
                screenName={this.screenName}
            >
                <div className='mx_InviteDialog_content'>
                    { dialogContent }
                </div>
            </BaseDialog>
        );
    }
}
