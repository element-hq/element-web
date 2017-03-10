//@flow

import {ContentState} from 'draft-js';
import * as RichText from './RichText';
import Markdown from './Markdown';
import _flow from 'lodash/flow';
import _clamp from 'lodash/clamp';

type MessageFormat = 'html' | 'markdown';

class HistoryItem {
    message: string = '';
    format: MessageFormat = 'html';

    constructor(message: string, format: MessageFormat) {
        this.message = message;
        this.format = format;
    }

    toContentState(format: MessageFormat): ContentState {
        let {message} = this;
        if (format === 'markdown') {
            if (this.format === 'html') {
                message = _flow([RichText.HTMLtoContentState, RichText.stateToMarkdown])(message);
            }
            return ContentState.createFromText(message);
        } else {
            if (this.format === 'markdown') {
                message = new Markdown(message).toHTML();
            }
            return RichText.HTMLtoContentState(message);
        }
    }
}

export default class ComposerHistoryManager {
    history: Array<HistoryItem> = [];
    prefix: string;
    lastIndex: number = 0;
    currentIndex: number = -1;

    constructor(roomId: string, prefix: string = 'mx_composer_history_') {
        this.prefix = prefix + roomId;

        // TODO: Performance issues?
        for(; sessionStorage.getItem(`${this.prefix}[${this.lastIndex}]`); this.lastIndex++, this.currentIndex++) {
            this.history.push(
                Object.assign(
                    new HistoryItem(),
                    JSON.parse(sessionStorage.getItem(`${this.prefix}[${this.lastIndex}]`)),
                ),
            );
        }
        this.currentIndex--;
    }

    addItem(message: string, format: MessageFormat) {
        const item = new HistoryItem(message, format);
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
