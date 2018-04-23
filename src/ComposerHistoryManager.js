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

import { Value } from 'slate';
import Html from 'slate-html-serializer';
import Markdown as Md from 'slate-md-serializer';
import Plain from 'slate-plain-serializer';
import * as RichText from './RichText';
import Markdown from './Markdown';

import _clamp from 'lodash/clamp';

type MessageFormat = 'rich' | 'markdown';

class HistoryItem {

    // Keeping message for backwards-compatibility
    message: string;
    value: Value;
    format: MessageFormat = 'rich';

    constructor(value: ?Value, format: ?MessageFormat) {
        this.rawContentState = contentState ? convertToRaw(contentState) : null;
        this.format = format;

    }

    toValue(outputFormat: MessageFormat): Value {
        if (outputFormat === 'markdown') {
            if (this.format === 'rich') {
                // convert a rich formatted history entry to its MD equivalent
                const markdown = new Markdown({});
                return new Value({ data: markdown.serialize(value) });
                // return ContentState.createFromText(RichText.stateToMarkdown(contentState));
            }
            else if (this.format === 'markdown') {
                return value;
            }
        } else if (outputFormat === 'rich') {
            if (this.format === 'markdown') {
                // convert MD formatted string to its rich equivalent.
                const plain = new Plain({});
                const md = new Md({});
                return md.deserialize(plain.serialize(value));
                // return RichText.htmlToContentState(new Markdown(contentState.getPlainText()).toHTML());
            }
            else if (this.format === 'rich') {
                return value;
            }
        }
        log.error("unknown format -> outputFormat conversion");
        return value;
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
        for (; item = sessionStorage.getItem(`${this.prefix}[${this.currentIndex}]`); this.currentIndex++) {
            this.history.push(
                Object.assign(new HistoryItem(), JSON.parse(item)),
            );
        }
        this.lastIndex = this.currentIndex;
    }

    save(value: Value, format: MessageFormat) {
        const item = new HistoryItem(value, format);
        this.history.push(item);
        this.currentIndex = this.lastIndex + 1;
        sessionStorage.setItem(`${this.prefix}[${this.lastIndex++}]`, JSON.stringify(item));
    }

    getItem(offset: number, format: MessageFormat): ?Value {
        this.currentIndex = _clamp(this.currentIndex + offset, 0, this.lastIndex - 1);
        const item = this.history[this.currentIndex];
        return item ? item.toValue(format) : null;
    }
}
