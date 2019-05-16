/*
Copyright 2019 New Vector Ltd

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

import AutocompleteWrapperModel from "./autocomplete";

class BasePart {
    constructor(text = "") {
        this._text = text;
    }

    acceptsInsertion(chr) {
        return true;
    }

    acceptsRemoval(position, chr) {
        return true;
    }

    merge(part) {
        return false;
    }

    split(offset) {
        const splitText = this.text.substr(offset);
        this._text = this.text.substr(0, offset);
        return new PlainPart(splitText);
    }

    // removes len chars, or returns the plain text this part should be replaced with
    // if the part would become invalid if it removed everything.
    remove(offset, len) {
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
    appendUntilRejected(str) {
        for (let i = 0; i < str.length; ++i) {
            const chr = str.charAt(i);
            if (!this.acceptsInsertion(chr, i)) {
                this._text = this._text + str.substr(0, i);
                return str.substr(i);
            }
        }
        this._text = this._text + str;
    }

    // inserts str at offset if all the characters in str were accepted, otherwise don't do anything
    // return whether the str was accepted or not.
    insertAll(offset, str) {
        for (let i = 0; i < str.length; ++i) {
            const chr = str.charAt(i);
            if (!this.acceptsInsertion(chr)) {
                return false;
            }
        }
        const beforeInsert = this._text.substr(0, offset);
        const afterInsert = this._text.substr(offset);
        this._text = beforeInsert + str + afterInsert;
        return true;
    }

    createAutoComplete() {}

    trim(len) {
        const remaining = this._text.substr(len);
        this._text = this._text.substr(0, len);
        return remaining;
    }

    get text() {
        return this._text;
    }

    get canEdit() {
        return true;
    }

    toString() {
        return `${this.type}(${this.text})`;
    }
}

export class PlainPart extends BasePart {
    acceptsInsertion(chr) {
        return chr !== "@" && chr !== "#" && chr !== ":" && chr !== "\n";
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

    updateDOMNode(node) {
        if (node.textContent !== this.text) {
            // console.log("changing plain text from", node.textContent, "to", this.text);
            node.textContent = this.text;
        }
    }

    canUpdateDOMNode(node) {
        return node.nodeType === Node.TEXT_NODE;
    }
}

class PillPart extends BasePart {
    constructor(resourceId, label) {
        super(label);
        this.resourceId = resourceId;
    }

    acceptsInsertion(chr) {
        return chr !== " ";
    }

    acceptsRemoval(position, chr) {
        return position !== 0;  //if you remove initial # or @, pill should become plain
    }

    toDOMNode() {
        const container = document.createElement("span");
        container.className = this.type;
        container.appendChild(document.createTextNode(this.text));
        return container;
    }

    updateDOMNode(node) {
        const textNode = node.childNodes[0];
        if (textNode.textContent !== this.text) {
            // console.log("changing pill text from", textNode.textContent, "to", this.text);
            textNode.textContent = this.text;
        }
        if (node.className !== this.type) {
            // console.log("turning", node.className, "into", this.type);
            node.className = this.type;
        }
    }

    canUpdateDOMNode(node) {
        return node.nodeType === Node.ELEMENT_NODE &&
               node.nodeName === "SPAN" &&
               node.childNodes.length === 1 &&
               node.childNodes[0].nodeType === Node.TEXT_NODE;
    }

    get canEdit() {
        return false;
    }
}

export class NewlinePart extends BasePart {
    acceptsInsertion(chr, i) {
        return (this.text.length + i) === 0 && chr === "\n";
    }

    acceptsRemoval(position, chr) {
        return true;
    }

    toDOMNode() {
        return document.createElement("br");
    }

    merge() {
        return false;
    }

    updateDOMNode() {}

    canUpdateDOMNode(node) {
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

export class RoomPillPart extends PillPart {
    constructor(displayAlias) {
        super(displayAlias, displayAlias);
    }

    get type() {
        return "room-pill";
    }
}

export class UserPillPart extends PillPart {
    get type() {
        return "user-pill";
    }
}


export class PillCandidatePart extends PlainPart {
    constructor(text, autoCompleteCreator) {
        super(text);
        this._autoCompleteCreator = autoCompleteCreator;
    }

    createAutoComplete(updateCallback) {
        return this._autoCompleteCreator(updateCallback);
    }

    acceptsInsertion(chr) {
        return true;
    }

    acceptsRemoval(position, chr) {
        return true;
    }

    get type() {
        return "pill-candidate";
    }
}

export class PartCreator {
    constructor(getAutocompleterComponent, updateQuery) {
        this._autoCompleteCreator = (updateCallback) => {
            return new AutocompleteWrapperModel(updateCallback, getAutocompleterComponent, updateQuery);
        };
    }

    createPartForInput(input) {
        switch (input[0]) {
            case "#":
            case "@":
            case ":":
                return new PillCandidatePart("", this._autoCompleteCreator);
            case "\n":
                return new NewlinePart();
            default:
                return new PlainPart();
        }
    }

    createDefaultPart(text) {
        return new PlainPart(text);
    }
}

