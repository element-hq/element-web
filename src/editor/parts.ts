/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {MatrixClient} from "matrix-js-sdk/src/client";
import {RoomMember} from "matrix-js-sdk/src/models/room-member";
import {Room} from "matrix-js-sdk/src/models/room";

import AutocompleteWrapperModel, {GetAutocompleterComponent, UpdateCallback, UpdateQuery} from "./autocomplete";
import * as Avatar from "../Avatar";

export interface ISerializedPart {
    type: string;
    text: string;
}

export abstract class BasePart {
    protected _text: string;

    constructor(text = "") {
        this._text = text;
    }

    acceptsInsertion(chr: string, offset: number, inputType: string) {
        return true;
    }

    acceptsRemoval(position: number, chr: string) {
        return true;
    }

    merge(part: BasePart) {
        return false;
    }

    split(offset: number) {
        const splitText = this.text.substr(offset);
        this._text = this.text.substr(0, offset);
        return new PlainPart(splitText);
    }

    // removes len chars, or returns the plain text this part should be replaced with
    // if the part would become invalid if it removed everything.
    remove(offset: number, len: number) {
        // validate
        const strWithRemoval = this.text.substr(0, offset) + this.text.substr(offset + len);
        for (let i = offset; i < (len + offset); ++i) {
            const chr = this.text.charAt(i);
            if (!this.acceptsRemoval(i, chr)) {
                return strWithRemoval;
            }
        }
        this._text = strWithRemoval;
    }

    // append str, returns the remaining string if a character was rejected.
    appendUntilRejected(str: string, inputType: string) {
        const offset = this.text.length;
        for (let i = 0; i < str.length; ++i) {
            const chr = str.charAt(i);
            if (!this.acceptsInsertion(chr, offset + i, inputType)) {
                this._text = this._text + str.substr(0, i);
                return str.substr(i);
            }
        }
        this._text = this._text + str;
    }

    // inserts str at offset if all the characters in str were accepted, otherwise don't do anything
    // return whether the str was accepted or not.
    validateAndInsert(offset: number, str: string, inputType: string) {
        for (let i = 0; i < str.length; ++i) {
            const chr = str.charAt(i);
            if (!this.acceptsInsertion(chr, offset + i, inputType)) {
                return false;
            }
        }
        const beforeInsert = this._text.substr(0, offset);
        const afterInsert = this._text.substr(offset);
        this._text = beforeInsert + str + afterInsert;
        return true;
    }

    createAutoComplete(updateCallback): AutocompleteWrapperModel | void {}

    trim(len: number) {
        const remaining = this._text.substr(len);
        this._text = this._text.substr(0, len);
        return remaining;
    }

    get text() {
        return this._text;
    }

    abstract get type(): string;

    get canEdit() {
        return true;
    }

    toString() {
        return `${this.type}(${this.text})`;
    }

    serialize(): ISerializedPart {
        return {type: this.type, text: this.text};
    }

    abstract updateDOMNode(node: Node);
    abstract canUpdateDOMNode(node: Node);
    abstract toDOMNode(): Node;
}

// exported for unit tests, should otherwise only be used through PartCreator
export class PlainPart extends BasePart {
    acceptsInsertion(chr: string, offset: number, inputType: string) {
        if (chr === "\n") {
            return false;
        }
        // when not pasting or dropping text, reject characters that should start a pill candidate
        if (inputType !== "insertFromPaste" && inputType !== "insertFromDrop") {
            return chr !== "@" && chr !== "#" && chr !== ":";
        }
        return true;
    }

    toDOMNode() {
        return document.createTextNode(this.text);
    }

    merge(part) {
        if (part.type === this.type) {
            this._text = this.text + part.text;
            return true;
        }
        return false;
    }

    get type() {
        return "plain";
    }

    updateDOMNode(node: Node) {
        if (node.textContent !== this.text) {
            node.textContent = this.text;
        }
    }

    canUpdateDOMNode(node: Node) {
        return node.nodeType === Node.TEXT_NODE;
    }
}

export abstract class PillPart extends BasePart {
    constructor(public resourceId: string, label) {
        super(label);
    }

    acceptsInsertion(chr: string) {
        return chr !== " ";
    }

    acceptsRemoval(position: number, chr: string) {
        return position !== 0;  //if you remove initial # or @, pill should become plain
    }

    toDOMNode() {
        const container = document.createElement("span");
        container.setAttribute("spellcheck", "false");
        container.className = this.className;
        container.appendChild(document.createTextNode(this.text));
        this.setAvatar(container);
        return container;
    }

    updateDOMNode(node: HTMLElement) {
        const textNode = node.childNodes[0];
        if (textNode.textContent !== this.text) {
            textNode.textContent = this.text;
        }
        if (node.className !== this.className) {
            node.className = this.className;
        }
        this.setAvatar(node);
    }

    canUpdateDOMNode(node: HTMLElement) {
        return node.nodeType === Node.ELEMENT_NODE &&
               node.nodeName === "SPAN" &&
               node.childNodes.length === 1 &&
               node.childNodes[0].nodeType === Node.TEXT_NODE;
    }

    // helper method for subclasses
    _setAvatarVars(node: HTMLElement, avatarUrl: string, initialLetter: string) {
        const avatarBackground = `url('${avatarUrl}')`;
        const avatarLetter = `'${initialLetter}'`;
        // check if the value is changing,
        // otherwise the avatars flicker on every keystroke while updating.
        if (node.style.getPropertyValue("--avatar-background") !== avatarBackground) {
            node.style.setProperty("--avatar-background", avatarBackground);
        }
        if (node.style.getPropertyValue("--avatar-letter") !== avatarLetter) {
            node.style.setProperty("--avatar-letter", avatarLetter);
        }
    }

    get canEdit() {
        return false;
    }

    abstract get className(): string;

    abstract setAvatar(node: HTMLElement): void;
}

class NewlinePart extends BasePart {
    acceptsInsertion(chr: string, offset: number) {
        return offset === 0 && chr === "\n";
    }

    acceptsRemoval(position: number, chr: string) {
        return true;
    }

    toDOMNode() {
        return document.createElement("br");
    }

    merge() {
        return false;
    }

    updateDOMNode() {}

    canUpdateDOMNode(node: HTMLElement) {
        return node.tagName === "BR";
    }

    get type() {
        return "newline";
    }

    // this makes the cursor skip this part when it is inserted
    // rather than trying to append to it, which is what we want.
    // As a newline can also be only one character, it makes sense
    // as it can only be one character long. This caused #9741.
    get canEdit() {
        return false;
    }
}

class RoomPillPart extends PillPart {
    constructor(displayAlias, private room: Room) {
        super(displayAlias, displayAlias);
    }

    setAvatar(node: HTMLElement) {
        let initialLetter = "";
        let avatarUrl = Avatar.avatarUrlForRoom(
            this.room,
            16 * window.devicePixelRatio,
            16 * window.devicePixelRatio,
            "crop");
        if (!avatarUrl) {
            initialLetter = Avatar.getInitialLetter(this.room ? this.room.name : this.resourceId);
            avatarUrl = Avatar.defaultAvatarUrlForString(this.room ? this.room.roomId : this.resourceId);
        }
        this._setAvatarVars(node, avatarUrl, initialLetter);
    }

    get type() {
        return "room-pill";
    }

    get className() {
        return "mx_RoomPill mx_Pill";
    }
}

class AtRoomPillPart extends RoomPillPart {
    get type() {
        return "at-room-pill";
    }
}

class UserPillPart extends PillPart {
    constructor(userId, displayName, private member: RoomMember) {
        super(userId, displayName);
    }

    setAvatar(node: HTMLElement) {
        if (!this.member) {
            return;
        }
        const name = this.member.name || this.member.userId;
        const defaultAvatarUrl = Avatar.defaultAvatarUrlForString(this.member.userId);
        const avatarUrl = Avatar.avatarUrlForMember(
            this.member,
            16 * window.devicePixelRatio,
            16 * window.devicePixelRatio,
            "crop");
        let initialLetter = "";
        if (avatarUrl === defaultAvatarUrl) {
            initialLetter = Avatar.getInitialLetter(name);
        }
        this._setAvatarVars(node, avatarUrl, initialLetter);
    }

    get type() {
        return "user-pill";
    }

    get className() {
        return "mx_UserPill mx_Pill";
    }

    serialize() {
        return {
            ...super.serialize(),
            resourceId: this.resourceId,
        };
    }
}

class PillCandidatePart extends PlainPart {
    constructor(text: string, private autoCompleteCreator: IAutocompleteCreator) {
        super(text);
    }

    createAutoComplete(updateCallback): AutocompleteWrapperModel {
        return this.autoCompleteCreator.create(updateCallback);
    }

    acceptsInsertion(chr: string, offset: number, inputType: string) {
        if (offset === 0) {
            return true;
        } else {
            return super.acceptsInsertion(chr, offset, inputType);
        }
    }

    merge() {
        return false;
    }

    acceptsRemoval(position: number, chr: string) {
        return true;
    }

    get type() {
        return "pill-candidate";
    }
}

export function getAutoCompleteCreator(getAutocompleterComponent: GetAutocompleterComponent, updateQuery: UpdateQuery) {
    return (partCreator: PartCreator) => {
        return (updateCallback: UpdateCallback) => {
            return new AutocompleteWrapperModel(
                updateCallback,
                getAutocompleterComponent,
                updateQuery,
                partCreator,
            );
        };
    };
}

type AutoCompleteCreator = ReturnType<typeof getAutoCompleteCreator>;

interface IAutocompleteCreator {
    create(updateCallback: UpdateCallback): AutocompleteWrapperModel;
}

export class PartCreator {
    protected readonly autoCompleteCreator: IAutocompleteCreator;

    constructor(private room: Room, private client: MatrixClient, autoCompleteCreator: AutoCompleteCreator = null) {
        // pre-create the creator as an object even without callback so it can already be passed
        // to PillCandidatePart (e.g. while deserializing) and set later on
        this.autoCompleteCreator = {create: autoCompleteCreator && autoCompleteCreator(this)};
    }

    setAutoCompleteCreator(autoCompleteCreator: AutoCompleteCreator) {
        this.autoCompleteCreator.create = autoCompleteCreator(this);
    }

    createPartForInput(input: string, partIndex: number, inputType?: string): BasePart {
        switch (input[0]) {
            case "#":
            case "@":
            case ":":
                return this.pillCandidate("");
            case "\n":
                return new NewlinePart();
            default:
                return new PlainPart();
        }
    }

    createDefaultPart(text: string) {
        return this.plain(text);
    }

    deserializePart(part: ISerializedPart) {
        switch (part.type) {
            case "plain":
                return this.plain(part.text);
            case "newline":
                return this.newline();
            case "at-room-pill":
                return this.atRoomPill(part.text);
            case "pill-candidate":
                return this.pillCandidate(part.text);
            case "room-pill":
                return this.roomPill(part.text);
            case "user-pill":
                return this.userPill(part.text, (part as PillPart).resourceId);
        }
    }

    plain(text: string) {
        return new PlainPart(text);
    }

    newline() {
        return new NewlinePart("\n");
    }

    pillCandidate(text: string) {
        return new PillCandidatePart(text, this.autoCompleteCreator);
    }

    roomPill(alias: string, roomId?: string) {
        let room;
        if (roomId || alias[0] !== "#") {
            room = this.client.getRoom(roomId || alias);
        } else {
            room = this.client.getRooms().find((r) => {
                return r.getCanonicalAlias() === alias ||
                       r.getAltAliases().includes(alias);
            });
        }
        return new RoomPillPart(alias, room);
    }

    atRoomPill(text: string) {
        return new AtRoomPillPart(text, this.room);
    }

    userPill(displayName: string, userId: string) {
        const member = this.room.getMember(userId);
        return new UserPillPart(userId, displayName, member);
    }

    createMentionParts(partIndex: number, displayName: string, userId: string) {
        const pill = this.userPill(displayName, userId);
        const postfix = this.plain(partIndex === 0 ? ": " : " ");
        return [pill, postfix];
    }
}

// part creator that support auto complete for /commands,
// used in SendMessageComposer
export class CommandPartCreator extends PartCreator {
    createPartForInput(text: string, partIndex: number) {
        // at beginning and starts with /? create
        if (partIndex === 0 && text[0] === "/") {
            // text will be inserted by model, so pass empty string
            return this.command("");
        } else {
            return super.createPartForInput(text, partIndex);
        }
    }

    command(text: string) {
        return new CommandPart(text, this.autoCompleteCreator);
    }

    deserializePart(part: BasePart) {
        if (part.type === "command") {
            return this.command(part.text);
        } else {
            return super.deserializePart(part);
        }
    }
}

class CommandPart extends PillCandidatePart {
    get type() {
        return "command";
    }
}
