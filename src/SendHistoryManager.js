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

import {clamp} from "lodash";

export default class SendHistoryManager {
    history: Array<HistoryItem> = [];
    prefix: string;
    lastIndex: number = 0; // used for indexing the storage
    currentIndex: number = 0; // used for indexing the loaded validated history Array

    constructor(roomId: string, prefix: string) {
        this.prefix = prefix + roomId;

        // TODO: Performance issues?
        let index = 0;
        let itemJSON;

        while (itemJSON = sessionStorage.getItem(`${this.prefix}[${index}]`)) {
            try {
                const serializedParts = JSON.parse(itemJSON);
                this.history.push(serializedParts);
            } catch (e) {
                console.warn("Throwing away unserialisable history", e);
                break;
            }
            ++index;
        }
        this.lastIndex = this.history.length - 1;
        // reset currentIndex to account for any unserialisable history
        this.currentIndex = this.lastIndex + 1;
    }

    save(editorModel: Object) {
        const serializedParts = editorModel.serializeParts();
        this.history.push(serializedParts);
        this.currentIndex = this.history.length;
        this.lastIndex += 1;
        sessionStorage.setItem(`${this.prefix}[${this.lastIndex}]`, JSON.stringify(serializedParts));
    }

    getItem(offset: number): ?HistoryItem {
        this.currentIndex = clamp(this.currentIndex + offset, 0, this.history.length - 1);
        return this.history[this.currentIndex];
    }
}
