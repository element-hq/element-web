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

const DELAY_TIME_MS = 500;
const KEY_TAB = 9;
const KEY_SHIFT = 16;

// word boundary -> 1 or more non-whitespace chars (group) -> end of line
const MATCH_REGEX = /\b(\S+)$/;

class TabComplete {

    constructor(opts) {
        opts.startingWordSuffix = opts.startingWordSuffix || "";
        opts.wordSuffix = opts.wordSuffix || "";
        this.opts = opts;
        this.completing = false;
        this.list = []; // full set of tab-completable things
        this.matchedList = []; // subset of completable things to loop over
        this.currentIndex = 0; // index in matchedList currently
        this.originalText = null; // original input text when tab was first hit
        this.textArea = opts.textArea; // DOMElement
        this.isFirstWord = false; // true if you tab-complete on the first word
    }

    /**
     * @param {TabComplete.Entry[]} completeList
     */
    setCompletionList(completeList) {
        this.list = completeList;
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
        return this.completing;
    }

    /**
     * @param {Number} numAheadToPeek Return *up to* this many elements.
     * @return {TabComplete.Entry[]}
     */
    peek(numAheadToPeek) {
        if (this.matchedList.length === 0) {
            return [];
        }

        var peekList = [
            this.matchedList[this.currentIndex]
        ];
        // return the current match item and then one with an index higher, and
        // so on until we've reached the requested limit OR we've looped back
        // around to our starting index.
        for (var i = 1; i < numAheadToPeek; i++) {
            var nextIndex = this.currentIndex + i;
            if (nextIndex >= this.matchedList.length) {
                // wrap around and take account of how far we've wrapped
                nextIndex -= this.matchedList.length;
            }
            // check for looping back to start
            if (nextIndex === this.currentIndex) {
                break; // no more items to return without looping
            }
            peekList.push(this.matchedList[nextIndex]);
        }
        return peekList;
    }

    /**
     * @param {DOMEvent} e
     * @return {Boolean} True if the tab complete state changed as a result of
     * this event.
     */
    onKeyDown(ev) {
        if (ev.keyCode !== KEY_TAB) {
            if (ev.keyCode !== KEY_SHIFT && this.completing) {
                // they're resuming typing; reset tab complete state vars.
                this.completing = false;
                this.currentIndex = 0;
                this._notifyStateChange();
                return true;
            }
            return false;
        }

        if (!this.textArea) {
            console.error("onKeyDown called before a <textarea> was set!");
            return false;
        }

        // init struct if necessary
        if (!this.completing) {
            this.completing = true;
            this.currentIndex = 0;
            this._calculateCompletions();
        }

        if (ev.shiftKey) {
            this.nextMatchedEntry(-1);
        }
        else {
            this.nextMatchedEntry(1);
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

        var looped = false;
        // work out the new index, wrapping if necessary.
        this.currentIndex += offset;
        if (this.currentIndex >= this.matchedList.length) {
            this.currentIndex = 0;
            looped = true;
        }
        else if (this.currentIndex < 0) {
            this.currentIndex = this.matchedList.length - 1;
        }

        var suffix = "";

        if (this.currentIndex !== 0) { // don't suffix the original text!
            suffix = this.isFirstWord ? this.opts.startingWordSuffix : this.opts.wordSuffix;
        }

        // set textarea to this new value
        this.textArea.value = this._replaceWith(
            this.matchedList[this.currentIndex].text + suffix
        );

        // visual display to the user that we looped - TODO: This should be configurable
        if (looped) {
            this.textArea.style["background-color"] = "#faa";
            setTimeout(() => { // yay for lexical 'this'!
                 this.textArea.style["background-color"] = "";
            }, 150);
        }
        else {
            this.textArea.style["background-color"] = ""; // cancel blinks TODO: required?
        }
    }

    _replaceWith(newVal) {
        return this.originalText.replace(MATCH_REGEX, newVal);
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
            new TabComplete.Entry(group) // first entry is always the original partial
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

TabComplete.Entry = function(text, image) {
    this.text = text;
    this.image = image;
};


module.exports = TabComplete;
