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

import { clamp } from "lodash";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";

import { SerializedPart } from "./editor/parts";
import EditorModel from "./editor/model";

interface IHistoryItem {
    parts: SerializedPart[];
    replyEventId?: string;
}

export default class SendHistoryManager {
    public history: Array<IHistoryItem> = [];
    public prefix: string;
    public lastIndex = 0; // used for indexing the storage
    public currentIndex = 0; // used for indexing the loaded validated history Array

    public constructor(roomId: string, prefix: string) {
        this.prefix = prefix + roomId;

        // TODO: Performance issues?
        let index = 0;
        let itemJSON;

        while ((itemJSON = sessionStorage.getItem(`${this.prefix}[${index}]`))) {
            try {
                this.history.push(JSON.parse(itemJSON));
            } catch (e) {
                logger.warn("Throwing away unserialisable history", e);
                break;
            }
            ++index;
        }
        this.lastIndex = this.history.length - 1;
        // reset currentIndex to account for any unserialisable history
        this.currentIndex = this.lastIndex + 1;
    }

    public static createItem(model: EditorModel, replyEvent?: MatrixEvent): IHistoryItem {
        return {
            parts: model.serializeParts(),
            replyEventId: replyEvent ? replyEvent.getId() : undefined,
        };
    }

    public save(editorModel: EditorModel, replyEvent?: MatrixEvent): void {
        const item = SendHistoryManager.createItem(editorModel, replyEvent);
        this.history.push(item);
        this.currentIndex = this.history.length;
        this.lastIndex += 1;
        sessionStorage.setItem(`${this.prefix}[${this.lastIndex}]`, JSON.stringify(item));
    }

    public getItem(offset: number): IHistoryItem {
        this.currentIndex = clamp(this.currentIndex + offset, 0, this.history.length - 1);
        return this.history[this.currentIndex];
    }
}
