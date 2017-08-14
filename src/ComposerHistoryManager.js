//@flow
/*
Copyright 2017 Aviral Dasgupta

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

import {ContentState, convertToRaw, convertFromRaw} from 'draft-js';
import * as RichText from './RichText';
import Markdown from './Markdown';
import _clamp from 'lodash/clamp';

type MessageFormat = 'html' | 'markdown';

class HistoryItem {

    // Keeping message for backwards-compatibility
    message: string;
    rawContentState: RawDraftContentState;
    format: MessageFormat = 'html';

    constructor(contentState: ?ContentState, format: ?MessageFormat) {
        this.rawContentState = contentState ? convertToRaw(contentState) : null;
        this.format = format;
    }

    toContentState(outputFormat: MessageFormat): ContentState {
        const contentState = convertFromRaw(this.rawContentState);
        if (outputFormat === 'markdown') {
            if (this.format === 'html') {
                return ContentState.createFromText(RichText.stateToMarkdown(contentState));
            }
        } else {
            if (this.format === 'markdown') {
                return RichText.htmlToContentState(new Markdown(contentState.getPlainText()).toHTML());
            }
        }
        // history item has format === outputFormat
        return contentState;
    }
}

export default class ComposerHistoryManager {
    history: Array<HistoryItem> = [];
    prefix: string;
    lastIndex: number = 0;
    currentIndex: number = 0;

    constructor(roomId: string, prefix: string = 'mx_composer_history_') {
        this.prefix = prefix + roomId;

        // TODO: Performance issues?
        let item;
        for(; item = sessionStorage.getItem(`${this.prefix}[${this.currentIndex}]`); this.currentIndex++) {
            this.history.push(
                Object.assign(new HistoryItem(), JSON.parse(item)),
            );
        }
        this.lastIndex = this.currentIndex;
    }

    save(contentState: ContentState, format: MessageFormat) {
        const item = new HistoryItem(contentState, format);
        this.history.push(item);
        this.currentIndex = this.lastIndex + 1;
        sessionStorage.setItem(`${this.prefix}[${this.lastIndex++}]`, JSON.stringify(item));
    }

    getItem(offset: number, format: MessageFormat): ?ContentState {
        this.currentIndex = _clamp(this.currentIndex + offset, 0, this.lastIndex - 1);
        const item = this.history[this.currentIndex];
        return item ? item.toContentState(format) : null;
    }
}
