/*
Copyright 2015 OpenMarket Ltd

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
var Entry = require("./TabCompleteEntries").Entry;

const DELAY_TIME_MS = 1000;
const KEY_TAB = 9;
const KEY_SHIFT = 16;
const KEY_WINDOWS = 91;

// word boundary -> 1 or more non-whitespace chars (group) -> end of line
const MATCH_REGEX = /\b(\S+)$/;

class TabComplete {

    constructor(opts) {
        opts.startingWordSuffix = opts.startingWordSuffix || "";
        opts.wordSuffix = opts.wordSuffix || "";
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
    }

    /**
     * @param {Entry[]} completeList
     */
    setCompletionList(completeList) {
        this.list = completeList;
        if (this.opts.onClickCompletes) {
            // assign onClick listeners for each entry to complete the text
            this.list.forEach((l) => {
                l.onClick = () => {
                    this.completeTo(l.getText());
                }
            });
        }
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

    startTabCompleting() {
        this.completing = true;
        this.currentIndex = 0;
        this._calculateCompletions();
    }

    /**
     * Do an auto-complete with the given word. This terminates the tab-complete.
     * @param {string} someVal
     */
    completeTo(someVal) {
        this.textArea.value = this._replaceWith(someVal, true);
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

    /**
     * @param {DOMEvent} e
     * @return {Boolean} True if the tab complete state changed as a result of
     * this event.
     */
    onKeyDown(ev) {
        var wasInPassiveMode = this.inPassiveMode && !ev.passive;
        this.inPassiveMode = ev.passive;

        if (ev.keyCode !== KEY_TAB) {
            if (this.completing && ev.keyCode !== KEY_SHIFT &&
                    !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.keyCode !== KEY_WINDOWS) {
                // they're resuming typing; reset tab complete state vars.
                this.stopTabCompleting();

                // fall through to auto-enter-tab-completing if set
                if (!this.opts.autoEnterTabComplete) {
                    return true;
                }
            }

            if (this.opts.autoEnterTabComplete) {
                clearTimeout(this.enterTabCompleteTimerId);
                this.enterTabCompleteTimerId = setTimeout(() => {
                    if (!this.completing) {
                        // inject a fake tab event so we use the same code paths
                        // as much as possible. Add a 'passive' flag to indicate
                        // that they didn't really hit this key.
                        this.onKeyDown({
                            keyCode: KEY_TAB,
                            passive: true,
                            preventDefault: function(){} // NOP
                        })
                    }
                }, DELAY_TIME_MS);
            }

            return false;
        }

        if (!this.textArea) {
            console.error("onKeyDown called before a <textarea> was set!");
            return false;
        }

        // init struct if necessary
        if (!this.completing) {
            this.startTabCompleting();
        }

        if (ev.shiftKey) {
            this.nextMatchedEntry(-1);
        }
        else {
            // if we were in passive mode we got out of sync by incrementing the
            // index to show the peek view but not set the text area. Therefore,
            // we want to set the *current* index rather than the *next* index.
            this.nextMatchedEntry(wasInPassiveMode ? 0 : 1);
        }

        // prevent the default TAB operation (typically focus shifting)
        ev.preventDefault();
        this._notifyStateChange();
        return true;
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
        var looped = (
            // impossible to loop if they've never hit tab; catch forward and backward looping
            !this.inPassiveMode && this.currentIndex === 0
        );

        if (!this.inPassiveMode) {
            // set textarea to this new value
            this.textArea.value = this._replaceWith(
                this.matchedList[this.currentIndex].text,
                this.currentIndex !== 0 // don't suffix the original text!
            );
        }

        // visual display to the user that we looped - TODO: This should be configurable
        if (looped) {
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

    _replaceWith(newVal, includeSuffix) {
        var replacementText = (
            newVal + (
                includeSuffix ?
                    (this.isFirstWord ? this.opts.startingWordSuffix : this.opts.wordSuffix) :
                    ""
            )
        );
        return this.originalText.replace(MATCH_REGEX, replacementText);
    }

    _calculateCompletions() {
        this.originalText = this.textArea.value; // cache starting text

        // grab the partial word from the text which we'll be tab-completing
        var res = MATCH_REGEX.exec(this.originalText);
        if (!res) {
            this.matchedList = [];
            return;
        }
        var [ ,group] = res; // ES6 destructuring; ignore first element
        this.isFirstWord = group.length === this.originalText.length;

        this.matchedList = [
            new Entry(group) // first entry is always the original partial
        ];

        // find matching entries in the set of entries given to us
        this.list.forEach((entry) => {
            if (entry.text.toLowerCase().indexOf(group.toLowerCase()) === 0) {
                this.matchedList.push(entry);
            }
        });

        // console.log("_calculateCompletions => %s", JSON.stringify(this.matchedList));
    }

    _notifyStateChange() {
        if (this.opts.onStateChange) {
            this.opts.onStateChange(this.completing);
        }
    }
};

module.exports = TabComplete;
