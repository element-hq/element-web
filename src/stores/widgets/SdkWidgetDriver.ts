/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Capability, Widget, WidgetDriver, WidgetKind } from "matrix-widget-api";
import { iterableUnion } from "../../utils/iterables";

export class SdkWidgetDriver extends WidgetDriver {
    public constructor(
        private widget: Widget,
        private widgetKind: WidgetKind,
        private locationEntityId: string,
        private preapprovedCapabilities: Set<Capability> = new Set(),
    ) {
        super();
    }

    public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
        // TODO: Prompt the user to accept capabilities
        return iterableUnion(requested, this.preapprovedCapabilities);
    }
}
