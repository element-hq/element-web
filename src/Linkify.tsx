/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import { merge } from "lodash";
import _Linkify from "linkify-react";

import { _linkifyString, ELEMENT_URL_PATTERN, options as linkifyMatrixOptions } from "./linkify-matrix";
import SettingsStore from "./settings/SettingsStore";
import { tryTransformPermalinkToLocalHref } from "./utils/permalinks/Permalinks";
import { mediaFromMxc } from "./customisations/Media";
import { PERMITTED_URL_SCHEMES } from "./utils/UrlUtils";

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const MEDIA_API_MXC_REGEX = /\/_matrix\/media\/r0\/(?:download|thumbnail)\/(.+?)\/(.+?)(?:[?/]|$)/;

export const transformTags: NonNullable<IOptions["transformTags"]> = {
    // custom to matrix
    // add blank targets to all hyperlinks except vector URLs
    "a": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        if (attribs.href) {
            attribs.target = "_blank"; // by default

            const transformed = tryTransformPermalinkToLocalHref(attribs.href); // only used to check if it is a link that can be handled locally
            if (
                transformed !== attribs.href || // it could be converted so handle locally symbols e.g. @user:server.tdl, matrix: and matrix.to
                attribs.href.match(ELEMENT_URL_PATTERN) // for https links to Element domains
            ) {
                delete attribs.target;
            }
        } else {
            // Delete the href attrib if it is falsy
            delete attribs.href;
        }

        attribs.rel = "noreferrer noopener"; // https://mathiasbynens.github.io/rel-noopener/
        return { tagName, attribs };
    },
    "img": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        let src = attribs.src;
        // Strip out imgs that aren't `mxc` here instead of using allowedSchemesByTag
        // because transformTags is used _before_ we filter by allowedSchemesByTag and
        // we don't want to allow images with `https?` `src`s.
        // We also drop inline images (as if they were not present at all) when the "show
        // images" preference is disabled. Future work might expose some UI to reveal them
        // like standalone image events have.
        if (!src || !SettingsStore.getValue("showImages")) {
            return { tagName, attribs: {} };
        }

        if (!src.startsWith("mxc://")) {
            const match = MEDIA_API_MXC_REGEX.exec(src);
            if (match) {
                src = `mxc://${match[1]}/${match[2]}`;
            }
        }

        if (!src.startsWith("mxc://")) {
            return { tagName, attribs: {} };
        }

        const requestedWidth = Number(attribs.width);
        const requestedHeight = Number(attribs.height);
        const width = Math.min(requestedWidth || 800, 800);
        const height = Math.min(requestedHeight || 600, 600);
        // specify width/height as max values instead of absolute ones to allow object-fit to do its thing
        // we only allow our own styles for this tag so overwrite the attribute
        attribs.style = `max-width: ${width}px; max-height: ${height}px;`;
        if (requestedWidth) {
            attribs.style += "width: 100%;";
        }
        if (requestedHeight) {
            attribs.style += "height: 100%;";
        }

        attribs.src = mediaFromMxc(src).getThumbnailOfSourceHttp(width, height)!;
        return { tagName, attribs };
    },
    "code": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        if (typeof attribs.class !== "undefined") {
            // Filter out all classes other than ones starting with language- for syntax highlighting.
            const classes = attribs.class.split(/\s/).filter(function (cl) {
                return cl.startsWith("language-") && !cl.startsWith("language-_");
            });
            attribs.class = classes.join(" ");
        }
        return { tagName, attribs };
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "*": function (tagName: string, attribs: sanitizeHtml.Attributes) {
        // Delete any style previously assigned, style is an allowedTag for font, span & img,
        // because attributes are stripped after transforming.
        // For img this is trusted as it is generated wholly within the img transformation method.
        if (tagName !== "img") {
            delete attribs.style;
        }

        // Sanitise and transform data-mx-color and data-mx-bg-color to their CSS
        // equivalents
        const customCSSMapper: Record<string, string> = {
            "data-mx-color": "color",
            "data-mx-bg-color": "background-color",
            // $customAttributeKey: $cssAttributeKey
        };

        let style = "";
        Object.keys(customCSSMapper).forEach((customAttributeKey) => {
            const cssAttributeKey = customCSSMapper[customAttributeKey];
            const customAttributeValue = attribs[customAttributeKey];
            if (
                customAttributeValue &&
                typeof customAttributeValue === "string" &&
                COLOR_REGEX.test(customAttributeValue)
            ) {
                style += cssAttributeKey + ":" + customAttributeValue + ";";
                delete attribs[customAttributeKey];
            }
        });

        if (style) {
            attribs.style = style + (attribs.style || "");
        }

        return { tagName, attribs };
    },
};

export const sanitizeHtmlParams: IOptions = {
    allowedTags: [
        // These tags are suggested by the spec https://spec.matrix.org/v1.10/client-server-api/#mroommessage-msgtypes
        "font", // custom to matrix for IRC-style font coloring
        "del", // for markdown
        "s",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "p",
        "a",
        "ul",
        "ol",
        "sup",
        "sub",
        "nl",
        "li",
        "b",
        "i",
        "u",
        "strong",
        "em",
        "strike",
        "code",
        "hr",
        "br",
        "div",
        "table",
        "thead",
        "caption",
        "tbody",
        "tr",
        "th",
        "td",
        "pre",
        "span",
        "img",
        "details",
        "summary",
    ],
    allowedAttributes: {
        // attribute sanitization happens after transformations, so we have to accept `style` for font, span & img
        // but strip during the transformation.
        // custom ones first:
        font: ["color", "data-mx-bg-color", "data-mx-color", "style"], // custom to matrix
        span: ["data-mx-maths", "data-mx-bg-color", "data-mx-color", "data-mx-spoiler", "style"], // custom to matrix
        div: ["data-mx-maths"],
        a: ["href", "name", "target", "rel"], // remote target: custom to matrix
        // img tags also accept width/height, we just map those to max-width & max-height during transformation
        img: ["src", "alt", "title", "style"],
        ol: ["start"],
        code: ["class"], // We don't actually allow all classes, we filter them in transformTags
    },
    // Lots of these won't come up by default because we don't allow them
    selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta"],
    // URL schemes we permit
    allowedSchemes: PERMITTED_URL_SCHEMES,
    allowProtocolRelative: false,
    transformTags,
    // 50 levels deep "should be enough for anyone"
    nestingLimit: 50,
};

/* Wrapper around linkify-react merging in our default linkify options */
export function Linkify({ as, options, children }: React.ComponentProps<typeof _Linkify>): ReactElement {
    return (
        <_Linkify as={as} options={merge({}, linkifyMatrixOptions, options)}>
            {children}
        </_Linkify>
    );
}

/**
 * Linkifies the given string. This is a wrapper around 'linkifyjs/string'.
 *
 * @param {string} str string to linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns {string} Linkified string
 */
export function linkifyString(str: string, options = linkifyMatrixOptions): string {
    return _linkifyString(str, options);
}

/**
 * Linkify the given string and sanitize the HTML afterwards.
 *
 * @param {string} dirtyHtml The HTML string to sanitize and linkify
 * @param {object} [options] Options for linkifyString. Default: linkifyMatrixOptions
 * @returns {string}
 */
export function linkifyAndSanitizeHtml(dirtyHtml: string, options = linkifyMatrixOptions): string {
    return sanitizeHtml(linkifyString(dirtyHtml, options), sanitizeHtmlParams);
}
