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

import { Optional } from "matrix-events-sdk";

import { ExtensibleEvent } from "./ExtensibleEvent";
import {
    ExtensibleEventType,
    IMessageRendering,
    IPartialEvent,
    isEventTypeSame,
    M_HTML,
    M_MESSAGE,
    ExtensibleAnyMessageEventContent,
    M_TEXT,
} from "../@types/extensible_events";
import { isOptionalAString, isProvided } from "./utilities";
import { InvalidEventError } from "./InvalidEventError";

/**
 * Represents a message event. Message events are the simplest form of event with
 * just text (optionally of different mimetypes, like HTML).
 *
 * Message events can additionally be an Emote or Notice, though typically those
 * are represented as EmoteEvent and NoticeEvent respectively.
 */
export class MessageEvent extends ExtensibleEvent<ExtensibleAnyMessageEventContent> {
    /**
     * The default text for the event.
     */
    public readonly text: string;

    /**
     * The default HTML for the event, if provided.
     */
    public readonly html: Optional<string>;

    /**
     * All the different renderings of the message. Note that this is the same
     * format as an m.message body but may contain elements not found directly
     * in the event content: this is because this is interpreted based off the
     * other information available in the event.
     */
    public readonly renderings: IMessageRendering[];

    /**
     * Creates a new MessageEvent from a pure format. Note that the event is
     * *not* parsed here: it will be treated as a literal m.message primary
     * typed event.
     * @param wireFormat - The event.
     */
    public constructor(wireFormat: IPartialEvent<ExtensibleAnyMessageEventContent>) {
        super(wireFormat);

        const mmessage = M_MESSAGE.findIn(this.wireContent);
        const mtext = M_TEXT.findIn<string>(this.wireContent);
        const mhtml = M_HTML.findIn<string>(this.wireContent);
        if (isProvided(mmessage)) {
            if (!Array.isArray(mmessage)) {
                throw new InvalidEventError("m.message contents must be an array");
            }
            const text = mmessage.find((r) => !isProvided(r.mimetype) || r.mimetype === "text/plain");
            const html = mmessage.find((r) => r.mimetype === "text/html");

            if (!text) throw new InvalidEventError("m.message is missing a plain text representation");

            this.text = text.body;
            this.html = html?.body;
            this.renderings = mmessage;
        } else if (isOptionalAString(mtext)) {
            this.text = mtext;
            this.html = mhtml;
            this.renderings = [{ body: mtext, mimetype: "text/plain" }];
            if (this.html) {
                this.renderings.push({ body: this.html, mimetype: "text/html" });
            }
        } else {
            throw new InvalidEventError("Missing textual representation for event");
        }
    }

    public isEquivalentTo(primaryEventType: ExtensibleEventType): boolean {
        return isEventTypeSame(primaryEventType, M_MESSAGE);
    }

    protected serializeMMessageOnly(): ExtensibleAnyMessageEventContent {
        let messageRendering: ExtensibleAnyMessageEventContent = {
            [M_MESSAGE.name]: this.renderings,
        };

        // Use the shorthand if it's just a simple text event
        if (this.renderings.length === 1) {
            const mime = this.renderings[0].mimetype;
            if (mime === undefined || mime === "text/plain") {
                messageRendering = {
                    [M_TEXT.name]: this.renderings[0].body,
                };
            }
        }

        return messageRendering;
    }

    public serialize(): IPartialEvent<object> {
        return {
            type: "m.room.message",
            content: {
                ...this.serializeMMessageOnly(),
                body: this.text,
                msgtype: "m.text",
                format: this.html ? "org.matrix.custom.html" : undefined,
                formatted_body: this.html ?? undefined,
            },
        };
    }

    /**
     * Creates a new MessageEvent from text and HTML.
     * @param text - The text.
     * @param html - Optional HTML.
     * @returns The representative message event.
     */
    public static from(text: string, html?: string): MessageEvent {
        return new MessageEvent({
            type: M_MESSAGE.name,
            content: {
                [M_TEXT.name]: text,
                [M_HTML.name]: html,
            },
        });
    }
}
