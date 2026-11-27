/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MetadataStripError } from "./MetadataStripError";

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
/** Adobe's HDR gain map properties, as used by Ultra HDR. */
const HDRGM_NS = "http://ns.adobe.com/hdr-gain-map/1.0/";
/** Google's container directory, which lists the images appended to a JPEG. */
const CONTAINER_NS = "http://ns.google.com/photos/1.0/container/";
const ITEM_NS = "http://ns.google.com/photos/1.0/container/item/";

/** Container item properties which describe the images rather than the photo. */
const KEPT_ITEM_PROPERTIES = ["Semantic", "Mime"];

/**
 * Whether an XMP packet holds HDR gain map properties, which are needed to display an Ultra HDR photo.
 */
export function hasGainMapXmp(xmp: string): boolean {
    return xmp.includes(HDRGM_NS);
}

function escapeAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * Builds the container directory, keeping only the type of each image and setting the length of each image
 * after the primary to its new length. Images without a new length were dropped, so are left out.
 */
function buildDirectory(directory: Element, itemLengths: number[]): string {
    const items = Array.from(directory.getElementsByTagNameNS(CONTAINER_NS, "Item")).slice(0, itemLengths.length + 1);
    const lis = items.map((item, i) => {
        const attributes = KEPT_ITEM_PROPERTIES.filter((name) => item.hasAttributeNS(ITEM_NS, name)).map(
            (name) => ` Item:${name}="${escapeAttribute(item.getAttributeNS(ITEM_NS, name)!)}"`,
        );
        if (i > 0) attributes.push(` Item:Length="${itemLengths[i - 1]}"`);
        return `<rdf:li rdf:parseType="Resource"><Container:Item${attributes.join("")}/></rdf:li>`;
    });
    return `<Container:Directory><rdf:Seq>${lis.join("")}</rdf:Seq></Container:Directory>`;
}

/**
 * Builds an XMP packet holding only the HDR gain map properties of another, dropping everything else such as
 * the location, device and editing history.
 *
 * @param xmp - the original XMP packet
 * @param itemLengths - for the primary image, the lengths of the images appended to it, in order, which
 *     replace those in its container directory. Omit for the gain map image itself.
 * @returns the new packet, or undefined if there were no gain map properties to keep
 */
export function buildGainMapXmp(xmp: string, itemLengths?: number[]): string | undefined {
    const doc = new DOMParser().parseFromString(xmp, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) throw new MetadataStripError("Malformed XMP");

    const attributes: string[] = [];
    const elements: string[] = [];
    let directory: Element | undefined;
    const serializer = new XMLSerializer();
    for (const description of Array.from(doc.getElementsByTagNameNS(RDF_NS, "Description"))) {
        for (const attribute of Array.from(description.attributes)) {
            if (attribute.namespaceURI === HDRGM_NS) {
                attributes.push(` hdrgm:${attribute.localName}="${escapeAttribute(attribute.value)}"`);
            }
        }
        for (const child of Array.from(description.children)) {
            if (child.namespaceURI === HDRGM_NS) {
                elements.push(serializer.serializeToString(child));
            } else if (child.namespaceURI === CONTAINER_NS && child.localName === "Directory") {
                directory = child;
            }
        }
    }
    if (attributes.length === 0 && elements.length === 0) return undefined;

    const directoryXml = directory && itemLengths ? buildDirectory(directory, itemLengths) : "";
    const containerNamespaces = directoryXml ? ` xmlns:Container="${CONTAINER_NS}" xmlns:Item="${ITEM_NS}"` : "";
    return (
        `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${RDF_NS}">` +
        `<rdf:Description rdf:about="" xmlns:hdrgm="${HDRGM_NS}"${containerNamespaces}${attributes.join("")}>` +
        `${elements.join("")}${directoryXml}</rdf:Description></rdf:RDF></x:xmpmeta>`
    );
}
