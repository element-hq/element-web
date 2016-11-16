/*
Copyright 2015 OpenMarket Ltd

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

var dis = require("./dispatcher");
var sdk = require("./index");

// FIXME: these vars should be bundled up and attached to
// module.exports otherwise this will break when included by both
// react-sdk and apps layered on top.

var DEBUG = 0;

// The colour keys to be replaced as referred to in CSS
var keyRgb = [
    "rgb(118, 207, 166)", // Vector Green
    "rgb(234, 245, 240)", // Vector Light Green
    "rgb(211, 239, 225)", // BottomLeftMenu overlay (20% Vector Green)
];

// Some algebra workings for calculating the tint % of Vector Green & Light Green
// x * 118 + (1 - x) * 255 = 234
// x * 118 + 255 - 255 * x = 234
// x * 118 - x * 255 = 234 - 255
// (255 - 118) x = 255 - 234
// x = (255 - 234) / (255 - 118) = 0.16

// The colour keys to be replaced as referred to in SVGs
var keyHex = [
    "#76CFA6", // Vector Green
    "#EAF5F0", // Vector Light Green
    "#D3EFE1", // BottomLeftMenu overlay (20% Vector Green overlaid on Vector Light Green)
];

// cache of our replacement colours
// defaults to our keys.
var colors = [
    keyHex[0],
    keyHex[1],
    keyHex[2],
];

var cssFixups = [
    // {
    //     style: a style object that should be fixed up taken from a stylesheet
    //     attr: name of the attribute to be clobbered, e.g. 'color'
    //     index: ordinal of primary, secondary or tertiary
    // }
];

// CSS attributes to be fixed up
var cssAttrs = [
    "color",
    "backgroundColor",
    "borderColor",
    "borderTopColor",
    "borderBottomColor",
    "borderLeftColor",
];

var svgAttrs = [
    "fill",
    "stroke",
];

var cached = false;

function calcCssFixups() {
    if (DEBUG) console.log("calcSvgFixups start");
    for (var i = 0; i < document.styleSheets.length; i++) {
        var ss = document.styleSheets[i];
        if (!ss) continue; // well done safari >:(
        // Chromium apparently sometimes returns null here; unsure why.
        // see $14534907369972FRXBx:matrix.org in HQ
        // ...ah, it's because there's a third party extension like
        // privacybadger inserting its own stylesheet in there with a
        // resource:// URI or something which results in a XSS error.
        // See also #vector:matrix.org/$145357669685386ebCfr:matrix.org
        // ...except some browsers apparently return stylesheets without
        // hrefs, which we have no choice but ignore right now

        // XXX seriously? we are hardcoding the name of vector's CSS file in
        // here?
        //
        // Why do we need to limit it to vector's CSS file anyway - if there
        // are other CSS files affecting the doc don't we want to apply the
        // same transformations to them?
        //
        // Iterating through the CSS looking for matches to hack on feels
        // pretty horrible anyway. And what if the application skin doesn't use
        // Vector Green as its primary color?

        if (ss.href && !ss.href.match(/\/bundle.*\.css$/)) continue;

        if (!ss.cssRules) continue;
        for (var j = 0; j < ss.cssRules.length; j++) {
            var rule = ss.cssRules[j];
            if (!rule.style) continue;
            for (var k = 0; k < cssAttrs.length; k++) {
                var attr = cssAttrs[k];
                for (var l = 0; l < keyRgb.length; l++) {
                    if (rule.style[attr] === keyRgb[l]) {
                        cssFixups.push({
                            style: rule.style,
                            attr: attr,
                            index: l,
                        });
                    }
                }
            }
        }
    }
    if (DEBUG) console.log("calcSvgFixups end");
}

function applyCssFixups() {
    if (DEBUG) console.log("applyCssFixups start");
    for (var i = 0; i < cssFixups.length; i++) {
        var cssFixup = cssFixups[i];
        cssFixup.style[cssFixup.attr] = colors[cssFixup.index];
    }
    if (DEBUG) console.log("applyCssFixups end");
}

function hexToRgb(color) {
    if (color[0] === '#') color = color.slice(1);
    if (color.length === 3) {
        color = color[0] + color[0] +
                color[1] + color[1] +
                color[2] + color[2];
    }
    var val = parseInt(color, 16);
    var r = (val >> 16) & 255;
    var g = (val >> 8) & 255;
    var b = val & 255;
    return [r, g, b];
}

function rgbToHex(rgb) {
    var val = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    return '#' + (0x1000000 + val).toString(16).slice(1)
}

// List of functions to call when the tint changes.
const tintables = [];

module.exports = {
    /**
     * Register a callback to fire when the tint changes.
     * This is used to rewrite the tintable SVGs with the new tint.
     *
     * It's not possible to unregister a tintable callback. So this can only be
     * used to register a static callback. If a set of tintables will change
     * over time then the best bet is to register a single callback for the
     * entire set.
     *
     * @param {Function} tintable Function to call when the tint changes.
     */
    registerTintable : function(tintable) {
        tintables.push(tintable);
    },

    tint: function(primaryColor, secondaryColor, tertiaryColor) {

        if (!cached) {
            calcCssFixups();
            cached = true;
        }

        if (!primaryColor) {
            primaryColor = "#76CFA6"; // Vector green
            secondaryColor = "#EAF5F0"; // Vector light green
        }

        if (!secondaryColor) {
            var x = 0.16; // average weighting factor calculated from vector green & light green
            var rgb = hexToRgb(primaryColor);
            rgb[0] = x * rgb[0] + (1 - x) * 255;
            rgb[1] = x * rgb[1] + (1 - x) * 255;
            rgb[2] = x * rgb[2] + (1 - x) * 255;
            secondaryColor = rgbToHex(rgb);
        }

        if (!tertiaryColor) {
            var x = 0.19;
            var rgb1 = hexToRgb(primaryColor);
            var rgb2 = hexToRgb(secondaryColor);
            rgb1[0] = x * rgb1[0] + (1 - x) * rgb2[0];
            rgb1[1] = x * rgb1[1] + (1 - x) * rgb2[1];
            rgb1[2] = x * rgb1[2] + (1 - x) * rgb2[2];
            tertiaryColor = rgbToHex(rgb1);
        }

        if (colors[0] === primaryColor &&
            colors[1] === secondaryColor &&
            colors[2] === tertiaryColor)
        {
            return;
        }

        colors = [primaryColor, secondaryColor, tertiaryColor];

        if (DEBUG) console.log("Tinter.tint");

        // go through manually fixing up the stylesheets.
        applyCssFixups();

        // tell all the SVGs to go fix themselves up
        // we don't do this as a dispatch otherwise it will visually lag
        tintables.forEach(function(tintable) {
            tintable();
        });
    },

    // XXX: we could just move this all into TintableSvg, but as it's so similar
    // to the CSS fixup stuff in Tinter (just that the fixups are stored in TintableSvg)
    // keeping it here for now.
    calcSvgFixups: function(svgs) {
        // go through manually fixing up SVG colours.
        // we could do this by stylesheets, but keeping the stylesheets
        // updated would be a PITA, so just brute-force search for the
        // key colour; cache the element and apply.

        if (DEBUG) console.log("calcSvgFixups start for " + svgs);
        var fixups = [];
        for (var i = 0; i < svgs.length; i++) {
            var svgDoc;
            try {
                svgDoc = svgs[i].contentDocument;
            }
            catch(e) {
                var msg = 'Failed to get svg.contentDocument of ' + svgs[i].toString();
                if (e.message) {
                    msg += e.message;
                }
                if (e.stack) {
                    msg += ' | stack: ' + e.stack;
                }
                console.error(e);
            }
            if (!svgDoc) continue;
            var tags = svgDoc.getElementsByTagName("*");
            for (var j = 0; j < tags.length; j++) {
                var tag = tags[j];
                for (var k = 0; k < svgAttrs.length; k++) {
                    var attr = svgAttrs[k];
                    for (var l = 0; l < keyHex.length; l++) {
                        if (tag.getAttribute(attr) && tag.getAttribute(attr).toUpperCase() === keyHex[l]) {
                            fixups.push({
                                node: tag,
                                attr: attr,
                                index: l,
                            });
                        }
                    }
                }
            }
        }
        if (DEBUG) console.log("calcSvgFixups end");

        return fixups;
    },

    applySvgFixups: function(fixups) {
        if (DEBUG) console.log("applySvgFixups start for " + fixups);
        for (var i = 0; i < fixups.length; i++) {
            var svgFixup = fixups[i];
            svgFixup.node.setAttribute(svgFixup.attr, colors[svgFixup.index]);
        }
        if (DEBUG) console.log("applySvgFixups end");
    }
};
