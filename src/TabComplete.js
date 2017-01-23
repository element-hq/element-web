/*
Copyright 2015, 2016 OpenMarket Ltd

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

import { Entry, MemberEntry, CommandEntry } from './TabCompleteEntries';
import SlashCommands from './SlashCommands';
import MatrixClientPeg from './MatrixClientPeg';

const DELAY_TIME_MS = 1000;
const KEY_TAB = 9;
const KEY_SHIFT = 16;
const KEY_WINDOWS = 91;

// NB: DO NOT USE \b its "words" are roman alphabet only!
//
// Capturing group containing the start
// of line or a whitespace char
//     \_______________       __________Capturing group of 0 or more non-whitespace chars
//                    _|__  _|_         followed by the end of line
//                   /    \/   \
const MATCH_REGEX = /(^|\s)(\S*)$/;

class TabComplete {

    constructor(opts) {
        opts.allowLooping = opts.allowLooping || false;
        opts.autoEnterTabComplete = opts.autoEnterTabComplete || false;
        opts.onClickCompletes = opts.onClickCompletes || false;
        this.opts = opts;
        this.completing = false;
        this.list = []; // full set of tab-completable things
        this.matchedList = []; // subset of completable things to loop over
        this.currentIndex = 0; // index in matchedList currently
        this.originalText = null; // original input text when tab was first hit
        this.textArea = opts.textArea; // DOMElement
        this.isFirstWord = false; // true if you tab-complete on the first word
        this.enterTabCompleteTimerId = null;
        this.inPassiveMode = false;

        // Map tracking ordering of the room members.
        // userId: integer, highest comes first.
        this.memberTabOrder = {};

        // monotonically increasing counter used for tracking ordering of members
        this.memberOrderSeq = 0;
    }

    /**
     * Call this when a a UI element representing a tab complete entry has been clicked
     * @param {entry} The entry that was clicked
     */
    onEntryClick(entry) {
        if (this.opts.onClickCompletes) {
            this.completeTo(entry);
        }
    }

    loadEntries(room) {
        this._makeEntries(room);
        this._initSorting(room);
        this._sortEntries();
    }

    onMemberSpoke(member) {
        if (this.memberTabOrder[member.userId] === undefined) {
            this.list.push(new MemberEntry(member));
        }
        this.memberTabOrder[member.userId] = this.memberOrderSeq++;
        this._sortEntries();
    }

    /**
     * @param {DOMElement}
     */
    setTextArea(textArea) {
        this.textArea = textArea;
    }

    /**
     * @return {Boolean}
     */
    isTabCompleting() {
        // actually have things to tab over
        return this.completing && this.matchedList.length > 1;
    }

    stopTabCompleting() {
        this.completing = false;
        this.currentIndex = 0;
        this._notifyStateChange();
    }

    startTabCompleting(passive) {
        this.originalText = this.textArea.value; // cache starting text

        // grab the partial word from the text which we'll be tab-completing
        var res = MATCH_REGEX.exec(this.originalText);
        if (!res) {
            this.matchedList = [];
            return;
        }
        // ES6 destructuring; ignore first element (the complete match)
        var [, boundaryGroup, partialGroup] = res;

        if (partialGroup.length === 0 && passive) {
            return;
        }

        this.isFirstWord = partialGroup.length === this.originalText.length;

        this.completing = true;
        this.currentIndex = 0;

        this.matchedList = [
            new Entry(partialGroup) // first entry is always the original partial
        ];

        // find matching entries in the set of entries given to us
        this.list.forEach((entry) => {
            if (entry.text.toLowerCase().indexOf(partialGroup.toLowerCase()) === 0) {
                this.matchedList.push(entry);
            }
        });

        // console.log("calculated completions => %s", JSON.stringify(this.matchedList));
    }

    /**
     * Do an auto-complete with the given word. This terminates the tab-complete.
     * @param {Entry} entry The tab-complete entry to complete to.
     */
    completeTo(entry) {
        this.textArea.value = this._replaceWith(
            entry.getFillText(), true, entry.getSuffix(this.isFirstWord)
        );
        this.stopTabCompleting();
        // keep focus on the text area
        this.textArea.focus();
    }

    /**
     * @param {Number} numAheadToPeek Return *up to* this many elements.
     * @return {Entry[]}
     */
    peek(numAheadToPeek) {
        if (this.matchedList.length === 0) {
            return [];
        }
        var peekList = [];

        // return the current match item and then one with an index higher, and
        // so on until we've reached the requested limit. If we hit the end of
        // the list of options we're done.
        for (var i = 0; i < numAheadToPeek; i++) {
            var nextIndex;
            if (this.opts.allowLooping) {
                nextIndex = (this.currentIndex + i) % this.matchedList.length;
            }
            else {
                nextIndex = this.currentIndex + i;
                if (nextIndex === this.matchedList.length) {
                    break;
                }
            }
            peekList.push(this.matchedList[nextIndex]);
        }
        // console.log("Peek list(%s): %s", numAheadToPeek, JSON.stringify(peekList));
        return peekList;
    }

    handleTabPress(passive, shiftKey) {
        var wasInPassiveMode = this.inPassiveMode && !passive;
        this.inPassiveMode = passive;

        if (!this.completing) {
            this.startTabCompleting(passive);
        }

        if (shiftKey) {
            this.nextMatchedEntry(-1);
        }
        else {
            // if we were in passive mode we got out of sync by incrementing the
            // index to show the peek view but not set the text area. Therefore,
            // we want to set the *current* index rather than the *next* index.
            this.nextMatchedEntry(wasInPassiveMode ? 0 : 1);
        }
        this._notifyStateChange();
    }

    /**
     * @param {DOMEvent} e
     */
    onKeyDown(ev) {
        if (!this.textArea) {
            console.error("onKeyDown called before a <textarea> was set!");
            return;
        }

        if (ev.keyCode !== KEY_TAB) {
            // pressing any key (except shift, windows, cmd (OSX) and ctrl/alt combinations)
            // aborts the current tab completion
            if (this.completing && ev.keyCode !== KEY_SHIFT &&
                    !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.keyCode !== KEY_WINDOWS) {
                // they're resuming typing; reset tab complete state vars.
                this.stopTabCompleting();
            }


            // explicitly pressing any key except tab removes passive mode. Tab doesn't remove
            // passive mode because handleTabPress needs to know when passive mode is toggling
            // off so it can resync the textarea/peek list. If tab did remove passive mode then
            // handleTabPress would never be able to tell when passive mode toggled off.
            this.inPassiveMode = false;

            // pressing any key at all (except tab) restarts the automatic tab-complete timer
            if (this.opts.autoEnterTabComplete) {
                const cachedText = ev.target.value;
                clearTimeout(this.enterTabCompleteTimerId);
                this.enterTabCompleteTimerId = setTimeout(() => {
                    if (this.completing) {
                        // If you highlight text and CTRL+X it, tab-completing will not be reset.
                        // This check makes sure that if something like a cut operation has been
                        // done, that we correctly refresh the tab-complete list. Normal backspace
                        // operations get caught by the stopTabCompleting() section above, but
                        // because the CTRL key is held, this does not execute for CTRL+X.
                        if (cachedText !== this.textArea.value) {
                            this.stopTabCompleting();
                        }
                    }

                    if (!this.completing) {
                        this.handleTabPress(true, false);
                    }
                }, DELAY_TIME_MS);
            }

            return;
        }

        // ctrl-tab/alt-tab etc shouldn't trigger a complete
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

        // tab key has been pressed at this point
        this.handleTabPress(false, ev.shiftKey);

        // prevent the default TAB operation (typically focus shifting)
        ev.preventDefault();
    }

    /**
     * Set the textarea to the next value in the matched list.
     * @param {Number} offset Offset to apply *before* setting the next value.
     */
    nextMatchedEntry(offset) {
        if (this.matchedList.length === 0) {
            return;
        }

        // work out the new index, wrapping if necessary.
        this.currentIndex += offset;
        if (this.currentIndex >= this.matchedList.length) {
            this.currentIndex = 0;
        }
        else if (this.currentIndex < 0) {
            this.currentIndex = this.matchedList.length - 1;
        }
        var isTransitioningToOriginalText = (
            // impossible to transition if they've never hit tab
            !this.inPassiveMode && this.currentIndex === 0
        );

        if (!this.inPassiveMode) {
            // set textarea to this new value
            this.textArea.value = this._replaceWith(
                this.matchedList[this.currentIndex].getFillText(),
                this.currentIndex !== 0, // don't suffix the original text!
                this.matchedList[this.currentIndex].getSuffix(this.isFirstWord)
            );
        }

        // visual display to the user that we looped - TODO: This should be configurable
        if (isTransitioningToOriginalText) {
            this.textArea.style["background-color"] = "#faa";
            setTimeout(() => { // yay for lexical 'this'!
                 this.textArea.style["background-color"] = "";
            }, 150);

            if (!this.opts.allowLooping) {
                this.stopTabCompleting();
            }
        }
        else {
            this.textArea.style["background-color"] = ""; // cancel blinks TODO: required?
        }
    }

    _replaceWith(newVal, includeSuffix, suffix) {
        // The regex to replace the input matches a character of whitespace AND
        // the partial word. If we just use string.replace() with the regex it will
        // replace the partial word AND the character of whitespace. We want to
        // preserve whatever that character is (\n, \t, etc) so find out what it is now.
        var boundaryChar;
        var res = MATCH_REGEX.exec(this.originalText);
        if (res) {
            boundaryChar = res[1]; // the first captured group
        }
        if (boundaryChar === undefined) {
            console.warn("Failed to find boundary char on text: '%s'", this.originalText);
            boundaryChar = "";
        }

        suffix = suffix || "";
        if (!includeSuffix) {
            suffix = "";
        }

        var replacementText = boundaryChar + newVal + suffix;
        return this.originalText.replace(MATCH_REGEX, function() {
            return replacementText; // function form to avoid `$` special-casing
        });
    }

    _notifyStateChange() {
        if (this.opts.onStateChange) {
            this.opts.onStateChange(this.completing);
        }
    }

    _sortEntries() {
        // largest comes first
        const KIND_ORDER = {
            command: 1,
            member: 2,
        };

        this.list.sort((a, b) => {
            const kindOrderDifference = KIND_ORDER[b.kind] - KIND_ORDER[a.kind];
            if (kindOrderDifference != 0) {
                return kindOrderDifference;
            }

            if (a.kind == 'member') {
                let orderA = this.memberTabOrder[a.member.userId];
                let orderB = this.memberTabOrder[b.member.userId];
                if (orderA === undefined) orderA = -1;
                if (orderB === undefined) orderB = -1;

                return orderB - orderA;
            }

            // anything else we have no ordering for
            return 0;
        });
    }

    _makeEntries(room) {
        const myUserId = MatrixClientPeg.get().credentials.userId;

        const members = room.getJoinedMembers().filter(function(member) {
            if (member.userId !== myUserId) return true;
        });

        this.list = MemberEntry.fromMemberList(members).concat(
            CommandEntry.fromCommands(SlashCommands.getCommandList())
        );
    }

    _initSorting(room) {
        this.memberTabOrder = {};
        this.memberOrderSeq = 0;

        for (const ev of room.getLiveTimeline().getEvents()) {
            this.memberTabOrder[ev.getSender()] = this.memberOrderSeq++;
        }
    }
}

module.exports = TabComplete;
