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

import { EitherAnd } from "matrix-events-sdk";

import { UnstableValue } from "../NamespacedValue";
import { IMessageRendering } from "./extensible_events";

/**
 * Extensible topic event type based on MSC3765
 * https://github.com/matrix-org/matrix-spec-proposals/pull/3765
 *
 * @example
 * ```
 * {
 *      "type": "m.room.topic,
 *      "state_key": "",
 *      "content": {
 *          "topic": "All about **pizza**",
 *          "m.topic": [{
 *              "body": "All about **pizza**",
 *              "mimetype": "text/plain",
 *          }, {
 *              "body": "All about <b>pizza</b>",
 *              "mimetype": "text/html",
 *          }],
 *      }
 * }
 * ```
 */

/**
 * The event type for an m.topic event (in content)
 */
export const M_TOPIC = new UnstableValue("m.topic", "org.matrix.msc3765.topic");

/**
 * The event content for an m.topic event (in content)
 */
export type MTopicContent = IMessageRendering[];

/**
 * The event definition for an m.topic event (in content)
 */
export type MTopicEvent = EitherAnd<{ [M_TOPIC.name]: MTopicContent }, { [M_TOPIC.altName]: MTopicContent }>;

/**
 * The event content for an m.room.topic event
 */
export type MRoomTopicEventContent = { topic: string } & MTopicEvent;
