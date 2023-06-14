/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Relations, RelationsEvent, EventHandlerMap } from "./relations";
import { MatrixEvent } from "./event";
import { Listener } from "./typed-event-emitter";

export class RelatedRelations {
    private relations: Relations[];

    public constructor(relations: Relations[]) {
        this.relations = relations.filter((r) => !!r);
    }

    public getRelations(): MatrixEvent[] {
        return this.relations.reduce<MatrixEvent[]>((c, p) => [...c, ...p.getRelations()], []);
    }

    public on<T extends RelationsEvent>(ev: T, fn: Listener<RelationsEvent, EventHandlerMap, T>): void {
        this.relations.forEach((r) => r.on(ev, fn));
    }

    public off<T extends RelationsEvent>(ev: T, fn: Listener<RelationsEvent, EventHandlerMap, T>): void {
        this.relations.forEach((r) => r.off(ev, fn));
    }
}
