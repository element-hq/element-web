/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

/**
 * Some common queries and transformations on the editor model
 */

export function replaceRangeAndExpandSelection(range, newParts) {
    const {model} = range;
    model.transform(() => {
        const oldLen = range.length;
        const addedLen = range.replace(newParts);
        const firstOffset = range.start.asOffset(model);
        const lastOffset = firstOffset.add(oldLen + addedLen);
        return model.startRange(firstOffset.asPosition(model), lastOffset.asPosition(model));
    });
}

export function replaceRangeAndMoveCaret(range, newParts) {
    const {model} = range;
    model.transform(() => {
        const oldLen = range.length;
        const addedLen = range.replace(newParts);
        const firstOffset = range.start.asOffset(model);
        const lastOffset = firstOffset.add(oldLen + addedLen);
        return lastOffset.asPosition(model);
    });
}

export function rangeStartsAtBeginningOfLine(range) {
    const {model} = range;
    const startsWithPartial = range.start.offset !== 0;
    const isFirstPart = range.start.index === 0;
    const previousIsNewline = !isFirstPart && model.parts[range.start.index - 1].type === "newline";
    return !startsWithPartial && (isFirstPart || previousIsNewline);
}

export function rangeEndsAtEndOfLine(range) {
    const {model} = range;
    const lastPart = model.parts[range.end.index];
    const endsWithPartial = range.end.offset !== lastPart.length;
    const isLastPart = range.end.index === model.parts.length - 1;
    const nextIsNewline = !isLastPart && model.parts[range.end.index + 1].type === "newline";
    return !endsWithPartial && (isLastPart || nextIsNewline);
}

export function formatRangeAsQuote(range) {
    const {model, parts} = range;
    const {partCreator} = model;
    for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];
        if (part.type === "newline") {
            parts.splice(i + 1, 0, partCreator.plain("> "));
        }
    }
    parts.unshift(partCreator.plain("> "));
    if (!rangeStartsAtBeginningOfLine(range)) {
        parts.unshift(partCreator.newline());
    }
    if (!rangeEndsAtEndOfLine(range)) {
        parts.push(partCreator.newline());
    }

    parts.push(partCreator.newline());
    replaceRangeAndExpandSelection(range, parts);
}

export function formatRangeAsCode(range) {
    const {model, parts} = range;
    const {partCreator} = model;
    const needsBlock = parts.some(p => p.type === "newline");
    if (needsBlock) {
        parts.unshift(partCreator.plain("```"), partCreator.newline());
        if (!rangeStartsAtBeginningOfLine(range)) {
            parts.unshift(partCreator.newline());
        }
        parts.push(
            partCreator.newline(),
            partCreator.plain("```"));
        if (!rangeEndsAtEndOfLine(range)) {
            parts.push(partCreator.newline());
        }
    } else {
        parts.unshift(partCreator.plain("`"));
        parts.push(partCreator.plain("`"));
    }
    replaceRangeAndExpandSelection(range, parts);
}

export function toggleInlineFormat(range, prefix, suffix = prefix) {
    const {model, parts} = range;
    const {partCreator} = model;

    const isFormatted = parts.length &&
        parts[0].text.startsWith(prefix) &&
        parts[parts.length - 1].text.endsWith(suffix);

    if (isFormatted) {
        // remove prefix and suffix
        const partWithoutPrefix = parts[0].serialize();
        partWithoutPrefix.text = partWithoutPrefix.text.substr(prefix.length);
        parts[0] = partCreator.deserializePart(partWithoutPrefix);

        const partWithoutSuffix = parts[parts.length - 1].serialize();
        const suffixPartText = partWithoutSuffix.text;
        partWithoutSuffix.text = suffixPartText.substring(0, suffixPartText.length - suffix.length);
        parts[parts.length - 1] = partCreator.deserializePart(partWithoutSuffix);
    } else {
        parts.unshift(partCreator.plain(prefix));
        parts.push(partCreator.plain(suffix));
    }
    replaceRangeAndExpandSelection(range, parts);
}
