/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { EitherAnd, UnstableValue } from "matrix-events-sdk";

import {
    ExtensibleAnyMessageEventContent,
    REFERENCE_RELATION,
    RelatesToRelationship,
    TSNamespace,
} from "./extensible_events";

/**
 * Identifier for a disclosed poll.
 */
export const M_POLL_KIND_DISCLOSED = new UnstableValue("m.poll.disclosed", "org.matrix.msc3381.poll.disclosed");

/**
 * Identifier for an undisclosed poll.
 */
export const M_POLL_KIND_UNDISCLOSED = new UnstableValue("m.poll.undisclosed", "org.matrix.msc3381.poll.undisclosed");

/**
 * Any poll kind.
 */
export type PollKind = TSNamespace<typeof M_POLL_KIND_DISCLOSED> | TSNamespace<typeof M_POLL_KIND_UNDISCLOSED> | string;

/**
 * Known poll kind namespaces.
 */
export type KnownPollKind = typeof M_POLL_KIND_DISCLOSED | typeof M_POLL_KIND_UNDISCLOSED;

/**
 * The namespaced value for m.poll.start
 */
export const M_POLL_START = new UnstableValue("m.poll.start", "org.matrix.msc3381.poll.start");

/**
 * The m.poll.start type within event content
 */
export type PollStartSubtype = {
    question: ExtensibleAnyMessageEventContent;
    kind: PollKind;
    max_selections?: number; // default 1, always positive
    answers: PollAnswer[];
};

/**
 * A poll answer.
 */
export type PollAnswer = ExtensibleAnyMessageEventContent & { id: string };

/**
 * The event definition for an m.poll.start event (in content)
 */
export type PollStartEvent = EitherAnd<
    { [M_POLL_START.name]: PollStartSubtype },
    { [M_POLL_START.altName]: PollStartSubtype }
>;

/**
 * The content for an m.poll.start event
 */
export type PollStartEventContent = PollStartEvent & ExtensibleAnyMessageEventContent;

/**
 * The namespaced value for m.poll.response
 */
export const M_POLL_RESPONSE = new UnstableValue("m.poll.response", "org.matrix.msc3381.poll.response");

/**
 * The m.poll.response type within event content
 */
export type PollResponseSubtype = {
    answers: string[];
};

/**
 * The event definition for an m.poll.response event (in content)
 */
export type PollResponseEvent = EitherAnd<
    { [M_POLL_RESPONSE.name]: PollResponseSubtype },
    { [M_POLL_RESPONSE.altName]: PollResponseSubtype }
>;

/**
 * The content for an m.poll.response event
 */
export type PollResponseEventContent = PollResponseEvent & RelatesToRelationship<typeof REFERENCE_RELATION>;

/**
 * The namespaced value for m.poll.end
 */
export const M_POLL_END = new UnstableValue("m.poll.end", "org.matrix.msc3381.poll.end");

/**
 * The event definition for an m.poll.end event (in content)
 */
export type PollEndEvent = EitherAnd<{ [M_POLL_END.name]: {} }, { [M_POLL_END.altName]: {} }>;

/**
 * The content for an m.poll.end event
 */
export type PollEndEventContent = PollEndEvent &
    RelatesToRelationship<typeof REFERENCE_RELATION> &
    ExtensibleAnyMessageEventContent;
