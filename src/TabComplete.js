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

class TabComplete {

    constructor(opts) {
        opts.startingWordSuffix = opts.startingWordSuffix || "";
        opts.wordSuffix = opts.wordSuffix || "";
        this.opts = opts;

        this.tabStruct = {
            completing: false,
            original: null,
            index: 0
        };
        this.list = [];
        this.textArea = opts.textArea;
    }

    /**
     * @param {String[]} completeList
     */
    setCompletionList(completeList) {
        this.list = completeList;
    }

    setTextArea(textArea) {
        this.textArea = textArea;
    }

    isTabCompleting() {
        return this.tabStruct.completing;
    }

    next() {
        this.tabStruct.index++;
        this.setCompletionOption();
    }

    prev() {
        this.tabStruct.index --;
        if (this.tabStruct.index < 0) {
            // wrap to the last search match, and fix up to a real index
            // value after we've matched.
            this.tabStruct.index = Number.MAX_VALUE;
        }
        this.setCompletionOption();
    }

    setCompletionOption() {
        var searchIndex = 0;
        var targetIndex = this.tabStruct.index;
        var text = this.tabStruct.original;

        var search = /@?([a-zA-Z0-9_\-:\.]+)$/.exec(text);
        // console.log("Searched in '%s' - got %s", text, search);
        if (targetIndex === 0) { // 0 is always the original text
            this.textArea.value = text;
        }
        else if (search && search[1]) {
            // console.log("search found: " + search+" from "+text);
            var expansion;

            // FIXME: could do better than linear search here
            for (var i=0; i < this.list.length; i++) {
                if (searchIndex < targetIndex) {
                    if (this.list[i].toLowerCase().indexOf(search[1].toLowerCase()) === 0) {
                        expansion = this.list[i];
                        searchIndex++;
                    }
                }
            }

            if (searchIndex === targetIndex || targetIndex === Number.MAX_VALUE) {
                if (search[0].length === text.length) {
                    expansion += this.opts.startingWordSuffix;
                }
                else {
                    expansion += this.opts.wordSuffix;
                }
                this.textArea.value = text.replace(
                    /@?([a-zA-Z0-9_\-:\.]+)$/, expansion
                );
                // cancel blink
                this.textArea.style["background-color"] = "";
                if (targetIndex === Number.MAX_VALUE) {
                    // wrap the index around to the last index found
                    this.tabStruct.index = searchIndex;
                    targetIndex = searchIndex;
                }
            }
            else {
                // console.log("wrapped!");
                this.textArea.style["background-color"] = "#faa";
                setTimeout(() => { // yay for lexical 'this'!
                     this.textArea.style["background-color"] = "";
                }, 150);
                this.textArea.value = text;
                this.tabStruct.index = 0;
            }
        }
        else {
            this.tabStruct.index = 0;
        }
    }

    /**
     * @param {DOMEvent} e
     * @return {Boolean} True if the tab complete state changed as a result of
     * this event.
     */
    onKeyDown(ev) {
        if (ev.keyCode !== KEY_TAB) {
            if (ev.keyCode !== KEY_SHIFT && this.tabStruct.completing) {
                // they're resuming typing; reset tab complete state vars.
                this.tabStruct.completing = false;
                this.tabStruct.index = 0;
                return true;
            }
            return false;
        }

        if (!this.textArea) {
            console.error("onKeyDown called before a <textarea> was set!");
            return false;
        }

        // init struct if necessary
        if (!this.tabStruct.completing) {
            this.tabStruct.completing = true;
            this.tabStruct.index = 0;
            // cache starting text
            this.tabStruct.original = this.textArea.value;
        }

        if (ev.shiftKey) {
            this.prev();
        }
        else {
            this.next();
        }
        // prevent the default TAB operation (typically focus shifting)
        ev.preventDefault();
        return true;
    }

};


module.exports = TabComplete;
