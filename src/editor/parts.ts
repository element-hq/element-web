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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { Room } from "matrix-js-sdk/src/models/room";

import AutocompleteWrapperModel, {
    GetAutocompleterComponent,
    UpdateCallback,
    UpdateQuery,
} from "./autocomplete";
import * as Avatar from "../Avatar";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";

interface ISerializedPart {
    type: Type.Plain | Type.Newline | Type.Command | Type.PillCandidate;
    text: string;
}

interface ISerializedPillPart {
    type: Type.AtRoomPill | Type.RoomPill | Type.UserPill;
    text: string;
    resourceId?: string;
}

export type SerializedPart = ISerializedPart | ISerializedPillPart;

export enum Type {
    Plain = "plain",
    Newline = "newline",
    Command = "command",
    UserPill = "user-pill",
    RoomPill = "room-pill",
    AtRoomPill = "at-room-pill",
    PillCandidate = "pill-candidate",
}

interface IBasePart {
    text: string;
    type: Type.Plain | Type.Newline;
    canEdit: boolean;

    createAutoComplete(updateCallback: UpdateCallback): void;

    serialize(): SerializedPart;
    remove(offset: number, len: number): string | undefined;
    split(offset: number): IBasePart;
    validateAndInsert(offset: number, str: string, inputType: string): boolean;
    appendUntilRejected(str: string, inputType: string): string | undefined;
    updateDOMNode(node: Node): void;
    canUpdateDOMNode(node: Node): boolean;
    toDOMNode(): Node;
}

interface IPillCandidatePart extends Omit<IBasePart, "type" | "createAutoComplete"> {
    type: Type.PillCandidate | Type.Command;
    createAutoComplete(updateCallback: UpdateCallback): AutocompleteWrapperModel;
}

interface IPillPart extends Omit<IBasePart, "type" | "resourceId"> {
    type: Type.AtRoomPill | Type.RoomPill | Type.UserPill;
    resourceId: string;
}

export type Part = IBasePart | IPillCandidatePart | IPillPart;

abstract class BasePart {
    protected _text: string;

    constructor(text = "") {
        this._text = text;
    }

    protected acceptsInsertion(chr: string, offset: number, inputType: string): boolean {
        return true;
    }

    protected acceptsRemoval(position: number, chr: string): boolean {
        return true;
    }

    public merge(part: Part): boolean {
        return false;
    }

    public split(offset: number): IBasePart {
        const splitText = this.text.substr(offset);
        this._text = this.text.substr(0, offset);
        return new PlainPart(splitText);
    }

    // removes len chars, or returns the plain text this part should be replaced with
    // if the part would become invalid if it removed everything.
    public remove(offset: number, len: number): string | undefined {
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
    public appendUntilRejected(str: string, inputType: string): string | undefined {
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
    public validateAndInsert(offset: number, str: string, inputType: string): boolean {
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

    public createAutoComplete(updateCallback: UpdateCallback): void {}

    protected trim(len: number): string {
        const remaining = this._text.substr(len);
        this._text = this._text.substr(0, len);
        return remaining;
    }

    public get text(): string {
        return this._text;
    }

    public abstract get type(): Type;

    public get canEdit(): boolean {
        return true;
    }

    public toString(): string {
        return `${this.type}(${this.text})`;
    }

    public serialize(): SerializedPart {
        return {
            type: this.type as ISerializedPart["type"],
            text: this.text,
        };
    }

    public abstract updateDOMNode(node: Node): void;
    public abstract canUpdateDOMNode(node: Node): boolean;
    public abstract toDOMNode(): Node;
}

abstract class PlainBasePart extends BasePart {
    protected acceptsInsertion(chr: string, offset: number, inputType: string): boolean {
        if (chr === "\n") {
            return false;
        }
        // when not pasting or dropping text, reject characters that should start a pill candidate
        if (inputType !== "insertFromPaste" && inputType !== "insertFromDrop") {
            if (chr !== "@" && chr !== "#" && chr !== ":" && chr !== "+") {
                return true;
            }

            // split if we are at the beginning of the part text
            if (offset === 0) {
                return false;
            }

            // or split if the previous character is a space
            // or if it is a + and this is a :
            return this._text[offset - 1] !== " " &&
                (this._text[offset - 1] !== "+" || chr !== ":");
        }
        return true;
    }

    public toDOMNode(): Node {
        return document.createTextNode(this.text);
    }

    public merge(part): boolean {
        if (part.type === this.type) {
            this._text = this.text + part.text;
            return true;
        }
        return false;
    }

    public updateDOMNode(node: Node): void {
        if (node.textContent !== this.text) {
            node.textContent = this.text;
        }
    }

    public canUpdateDOMNode(node: Node): boolean {
        return node.nodeType === Node.TEXT_NODE;
    }
}

// exported for unit tests, should otherwise only be used through PartCreator
export class PlainPart extends PlainBasePart implements IBasePart {
    public get type(): IBasePart["type"] {
        return Type.Plain;
    }
}

export abstract class PillPart extends BasePart implements IPillPart {
    constructor(public resourceId: string, label) {
        super(label);
    }

    protected acceptsInsertion(chr: string): boolean {
        return chr !== " ";
    }

    protected acceptsRemoval(position: number, chr: string): boolean {
        return position !== 0;  //if you remove initial # or @, pill should become plain
    }

    public toDOMNode(): Node {
        const container = document.createElement("span");
        container.setAttribute("spellcheck", "false");
        container.setAttribute("contentEditable", "false");
        container.onclick = this.onClick;
        container.className = this.className;
        container.appendChild(document.createTextNode(this.text));
        this.setAvatar(container);
        return container;
    }

    public updateDOMNode(node: HTMLElement): void {
        const textNode = node.childNodes[0];
        if (textNode.textContent !== this.text) {
            textNode.textContent = this.text;
        }
        if (node.className !== this.className) {
            node.className = this.className;
        }
        if (node.onclick !== this.onClick) {
            node.onclick = this.onClick;
        }
        this.setAvatar(node);
    }

    public canUpdateDOMNode(node: HTMLElement): boolean {
        return node.nodeType === Node.ELEMENT_NODE &&
               node.nodeName === "SPAN" &&
               node.childNodes.length === 1 &&
               node.childNodes[0].nodeType === Node.TEXT_NODE;
    }

    // helper method for subclasses
    protected setAvatarVars(node: HTMLElement, avatarUrl: string, initialLetter: string): void {
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

    public serialize(): ISerializedPillPart {
        return {
            type: this.type,
            text: this.text,
            resourceId: this.resourceId,
        };
    }

    public get canEdit(): boolean {
        return false;
    }

    public abstract get type(): IPillPart["type"];

    protected abstract get className(): string;

    protected onClick?: () => void;

    protected abstract setAvatar(node: HTMLElement): void;
}

class NewlinePart extends BasePart implements IBasePart {
    protected acceptsInsertion(chr: string, offset: number): boolean {
        return offset === 0 && chr === "\n";
    }

    protected acceptsRemoval(position: number, chr: string): boolean {
        return true;
    }

    public toDOMNode(): Node {
        return document.createElement("br");
    }

    public merge(): boolean {
        return false;
    }

    public updateDOMNode(): void {}

    public canUpdateDOMNode(node: HTMLElement): boolean {
        return node.tagName === "BR";
    }

    public get type(): IBasePart["type"] {
        return Type.Newline;
    }

    // this makes the cursor skip this part when it is inserted
    // rather than trying to append to it, which is what we want.
    // As a newline can also be only one character, it makes sense
    // as it can only be one character long. This caused #9741.
    public get canEdit(): boolean {
        return false;
    }
}

class RoomPillPart extends PillPart {
    constructor(resourceId: string, label: string, private room: Room) {
        super(resourceId, label);
    }

    protected setAvatar(node: HTMLElement): void {
        let initialLetter = "";
        let avatarUrl = Avatar.avatarUrlForRoom(this.room, 16, 16, "crop");
        if (!avatarUrl) {
            initialLetter = Avatar.getInitialLetter(this.room ? this.room.name : this.resourceId);
            avatarUrl = Avatar.defaultAvatarUrlForString(this.room ? this.room.roomId : this.resourceId);
        }
        this.setAvatarVars(node, avatarUrl, initialLetter);
    }

    public get type(): IPillPart["type"] {
        return Type.RoomPill;
    }

    protected get className() {
        return "mx_RoomPill mx_Pill";
    }
}

class AtRoomPillPart extends RoomPillPart {
    constructor(text: string, room: Room) {
        super(text, text, room);
    }

    public get type(): IPillPart["type"] {
        return Type.AtRoomPill;
    }

    public serialize(): ISerializedPillPart {
        return {
            type: this.type,
            text: this.text,
        };
    }
}

class UserPillPart extends PillPart {
    constructor(userId, displayName, private member: RoomMember) {
        super(userId, displayName);
    }

    public get type(): IPillPart["type"] {
        return Type.UserPill;
    }

    protected get className() {
        return "mx_UserPill mx_Pill";
    }

    protected setAvatar(node: HTMLElement): void {
        if (!this.member) {
            return;
        }
        const name = this.member.name || this.member.userId;
        const defaultAvatarUrl = Avatar.defaultAvatarUrlForString(this.member.userId);
        const avatarUrl = Avatar.avatarUrlForMember(this.member, 16, 16, "crop");
        let initialLetter = "";
        if (avatarUrl === defaultAvatarUrl) {
            initialLetter = Avatar.getInitialLetter(name);
        }
        this.setAvatarVars(node, avatarUrl, initialLetter);
    }

    protected onClick = (): void => {
        defaultDispatcher.dispatch({
            action: Action.ViewUser,
            member: this.member,
        });
    };
}

class PillCandidatePart extends PlainBasePart implements IPillCandidatePart {
    constructor(text: string, private autoCompleteCreator: IAutocompleteCreator) {
        super(text);
    }

    public createAutoComplete(updateCallback: UpdateCallback): AutocompleteWrapperModel {
        return this.autoCompleteCreator.create(updateCallback);
    }

    protected acceptsInsertion(chr: string, offset: number, inputType: string): boolean {
        if (offset === 0) {
            return true;
        } else {
            return super.acceptsInsertion(chr, offset, inputType);
        }
    }

    public merge(): boolean {
        return false;
    }

    protected acceptsRemoval(position: number, chr: string): boolean {
        return true;
    }

    get type(): IPillCandidatePart["type"] {
        return Type.PillCandidate;
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

    constructor(
        private readonly room: Room,
        private readonly client: MatrixClient,
        autoCompleteCreator: AutoCompleteCreator = null,
    ) {
        // pre-create the creator as an object even without callback so it can already be passed
        // to PillCandidatePart (e.g. while deserializing) and set later on
        this.autoCompleteCreator = { create: autoCompleteCreator?.(this) };
    }

    public setAutoCompleteCreator(autoCompleteCreator: AutoCompleteCreator): void {
        this.autoCompleteCreator.create = autoCompleteCreator(this);
    }

    public createPartForInput(input: string, partIndex: number, inputType?: string): Part {
        switch (input[0]) {
            case "#":
            case "@":
            case ":":
            case "+":
                return this.pillCandidate("");
            case "\n":
                return new NewlinePart();
            default:
                return new PlainPart();
        }
    }

    public createDefaultPart(text: string): Part {
        return this.plain(text);
    }

    public deserializePart(part: SerializedPart): Part {
        switch (part.type) {
            case Type.Plain:
                return this.plain(part.text);
            case Type.Newline:
                return this.newline();
            case Type.AtRoomPill:
                return this.atRoomPill(part.text);
            case Type.PillCandidate:
                return this.pillCandidate(part.text);
            case Type.RoomPill:
                return this.roomPill(part.resourceId);
            case Type.UserPill:
                return this.userPill(part.text, part.resourceId);
        }
    }

    public plain(text: string): PlainPart {
        return new PlainPart(text);
    }

    public newline(): NewlinePart {
        return new NewlinePart("\n");
    }

    public pillCandidate(text: string): PillCandidatePart {
        return new PillCandidatePart(text, this.autoCompleteCreator);
    }

    public roomPill(alias: string, roomId?: string): RoomPillPart {
        let room;
        if (roomId || alias[0] !== "#") {
            room = this.client.getRoom(roomId || alias);
        } else {
            room = this.client.getRooms().find((r) => {
                return r.getCanonicalAlias() === alias ||
                       r.getAltAliases().includes(alias);
            });
        }
        return new RoomPillPart(alias, room ? room.name : alias, room);
    }

    public atRoomPill(text: string): AtRoomPillPart {
        return new AtRoomPillPart(text, this.room);
    }

    public userPill(displayName: string, userId: string): UserPillPart {
        const member = this.room.getMember(userId);
        return new UserPillPart(userId, displayName, member);
    }

    public createMentionParts(
        insertTrailingCharacter: boolean,
        displayName: string,
        userId: string,
    ): [UserPillPart, PlainPart] {
        const pill = this.userPill(displayName, userId);
        const postfix = this.plain(insertTrailingCharacter ? ": " : " ");
        return [pill, postfix];
    }
}

// part creator that support auto complete for /commands,
// used in SendMessageComposer
export class CommandPartCreator extends PartCreator {
    public createPartForInput(text: string, partIndex: number): Part {
        // at beginning and starts with /? create
        if (partIndex === 0 && text[0] === "/") {
            // text will be inserted by model, so pass empty string
            return this.command("");
        } else {
            return super.createPartForInput(text, partIndex);
        }
    }

    public command(text: string): CommandPart {
        return new CommandPart(text, this.autoCompleteCreator);
    }

    public deserializePart(part: SerializedPart): Part {
        if (part.type === Type.Command) {
            return this.command(part.text);
        } else {
            return super.deserializePart(part);
        }
    }
}

class CommandPart extends PillCandidatePart {
    public get type(): IPillCandidatePart["type"] {
        return Type.Command;
    }
}
