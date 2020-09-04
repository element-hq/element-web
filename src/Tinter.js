/*
Copyright 2015 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

const DEBUG = 0;

// utility to turn #rrggbb or rgb(r,g,b) into [red,green,blue]
function colorToRgb(color) {
    if (!color) {
        return [0, 0, 0];
    }

    if (color[0] === '#') {
        color = color.slice(1);
        if (color.length === 3) {
            color = color[0] + color[0] +
                    color[1] + color[1] +
                    color[2] + color[2];
        }
        const val = parseInt(color, 16);
        const r = (val >> 16) & 255;
        const g = (val >> 8) & 255;
        const b = val & 255;
        return [r, g, b];
    } else {
        const match = color.match(/rgb\((.*?),(.*?),(.*?)\)/);
        if (match) {
            return [
                parseInt(match[1]),
                parseInt(match[2]),
                parseInt(match[3]),
            ];
        }
    }
    return [0, 0, 0];
}

// utility to turn [red,green,blue] into #rrggbb
function rgbToColor(rgb) {
    const val = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    return '#' + (0x1000000 + val).toString(16).slice(1);
}

class Tinter {
    constructor() {
        // The default colour keys to be replaced as referred to in CSS
        // (should be overridden by .mx_theme_accentColor and .mx_theme_secondaryAccentColor)
        this.keyRgb = [
            "rgb(118, 207, 166)", // Vector Green
            "rgb(234, 245, 240)", // Vector Light Green
            "rgb(211, 239, 225)", // roomsublist-label-bg-color (20% Green overlaid on Light Green)
        ];

        // Some algebra workings for calculating the tint % of Vector Green & Light Green
        // x * 118 + (1 - x) * 255 = 234
        // x * 118 + 255 - 255 * x = 234
        // x * 118 - x * 255 = 234 - 255
        // (255 - 118) x = 255 - 234
        // x = (255 - 234) / (255 - 118) = 0.16

        // The colour keys to be replaced as referred to in SVGs
        this.keyHex = [
            "#76CFA6", // Vector Green
            "#EAF5F0", // Vector Light Green
            "#D3EFE1", // roomsublist-label-bg-color (20% Green overlaid on Light Green)
            "#FFFFFF", // white highlights of the SVGs (for switching to dark theme)
            "#000000", // black lowlights of the SVGs (for switching to dark theme)
        ];

        // track the replacement colours actually being used
        // defaults to our keys.
        this.colors = [
            this.keyHex[0],
            this.keyHex[1],
            this.keyHex[2],
            this.keyHex[3],
            this.keyHex[4],
        ];

        // track the most current tint request inputs (which may differ from the
        // end result stored in this.colors
        this.currentTint = [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ];

        this.cssFixups = [
            // { theme: {
            //      style: a style object that should be fixed up taken from a stylesheet
            //      attr: name of the attribute to be clobbered, e.g. 'color'
            //      index: ordinal of primary, secondary or tertiary
            //   },
            // }
        ];

        // CSS attributes to be fixed up
        this.cssAttrs = [
            "color",
            "backgroundColor",
            "borderColor",
            "borderTopColor",
            "borderBottomColor",
            "borderLeftColor",
        ];

        this.svgAttrs = [
            "fill",
            "stroke",
        ];

        // List of functions to call when the tint changes.
        this.tintables = [];

        // the currently loaded theme (if any)
        this.theme = undefined;

        // whether to force a tint (e.g. after changing theme)
        this.forceTint = false;
    }

    /**
     * Register a callback to fire when the tint changes.
     * This is used to rewrite the tintable SVGs with the new tint.
     *
     * It's not possible to unregister a tintable callback. So this can only be
     * used to register a static callback. If a set of tintables will change
     * over time then the best bet is to register a single callback for the
     * entire set.
     *
     * To ensure the tintable work happens at least once, it is also called as
     * part of registration.
     *
     * @param {Function} tintable Function to call when the tint changes.
     */
    registerTintable(tintable) {
        this.tintables.push(tintable);
        tintable();
    }

    getKeyRgb() {
        return this.keyRgb;
    }

    tint(primaryColor, secondaryColor, tertiaryColor) {
        return;
        // eslint-disable-next-line no-unreachable
        this.currentTint[0] = primaryColor;
        this.currentTint[1] = secondaryColor;
        this.currentTint[2] = tertiaryColor;

        this.calcCssFixups();

        if (DEBUG) {
            console.log("Tinter.tint(" + primaryColor + ", " +
                secondaryColor + ", " +
                tertiaryColor + ")");
        }

        if (!primaryColor) {
            primaryColor = this.keyRgb[0];
            secondaryColor = this.keyRgb[1];
            tertiaryColor = this.keyRgb[2];
        }

        if (!secondaryColor) {
            const x = 0.16; // average weighting factor calculated from vector green & light green
            const rgb = colorToRgb(primaryColor);
            rgb[0] = x * rgb[0] + (1 - x) * 255;
            rgb[1] = x * rgb[1] + (1 - x) * 255;
            rgb[2] = x * rgb[2] + (1 - x) * 255;
            secondaryColor = rgbToColor(rgb);
        }

        if (!tertiaryColor) {
            const x = 0.19;
            const rgb1 = colorToRgb(primaryColor);
            const rgb2 = colorToRgb(secondaryColor);
            rgb1[0] = x * rgb1[0] + (1 - x) * rgb2[0];
            rgb1[1] = x * rgb1[1] + (1 - x) * rgb2[1];
            rgb1[2] = x * rgb1[2] + (1 - x) * rgb2[2];
            tertiaryColor = rgbToColor(rgb1);
        }

        if (this.forceTint == false &&
            this.colors[0] === primaryColor &&
            this.colors[1] === secondaryColor &&
            this.colors[2] === tertiaryColor) {
            return;
        }

        this.forceTint = false;

        this.colors[0] = primaryColor;
        this.colors[1] = secondaryColor;
        this.colors[2] = tertiaryColor;

        if (DEBUG) {
            console.log("Tinter.tint final: (" + primaryColor + ", " +
                secondaryColor + ", " +
                tertiaryColor + ")");
        }

        // go through manually fixing up the stylesheets.
        this.applyCssFixups();

        // tell all the SVGs to go fix themselves up
        // we don't do this as a dispatch otherwise it will visually lag
        this.tintables.forEach(function(tintable) {
            tintable();
        });
    }

    tintSvgWhite(whiteColor) {
        this.currentTint[3] = whiteColor;

        if (!whiteColor) {
            whiteColor = this.colors[3];
        }
        if (this.colors[3] === whiteColor) {
            return;
        }
        this.colors[3] = whiteColor;
        this.tintables.forEach(function(tintable) {
            tintable();
        });
    }

    tintSvgBlack(blackColor) {
        this.currentTint[4] = blackColor;

        if (!blackColor) {
            blackColor = this.colors[4];
        }
        if (this.colors[4] === blackColor) {
            return;
        }
        this.colors[4] = blackColor;
        this.tintables.forEach(function(tintable) {
            tintable();
        });
    }


    setTheme(theme) {
        this.theme = theme;

        // update keyRgb from the current theme CSS itself, if it defines it
        if (document.getElementById('mx_theme_accentColor')) {
            this.keyRgb[0] = window.getComputedStyle(
                document.getElementById('mx_theme_accentColor')).color;
        }
        if (document.getElementById('mx_theme_secondaryAccentColor')) {
            this.keyRgb[1] = window.getComputedStyle(
                document.getElementById('mx_theme_secondaryAccentColor')).color;
        }
        if (document.getElementById('mx_theme_tertiaryAccentColor')) {
            this.keyRgb[2] = window.getComputedStyle(
                document.getElementById('mx_theme_tertiaryAccentColor')).color;
        }

        this.calcCssFixups();
        this.forceTint = true;

        this.tint(this.currentTint[0], this.currentTint[1], this.currentTint[2]);

        if (theme === 'dark') {
            // abuse the tinter to change all the SVG's #fff to #2d2d2d
            // XXX: obviously this shouldn't be hardcoded here.
            this.tintSvgWhite('#2d2d2d');
            this.tintSvgBlack('#dddddd');
        } else {
            this.tintSvgWhite('#ffffff');
            this.tintSvgBlack('#000000');
        }
    }

    calcCssFixups() {
        // cache our fixups
        if (this.cssFixups[this.theme]) return;

        if (DEBUG) {
            console.debug("calcCssFixups start for " + this.theme + " (checking " +
                document.styleSheets.length +
                " stylesheets)");
        }

        this.cssFixups[this.theme] = [];

        for (let i = 0; i < document.styleSheets.length; i++) {
            const ss = document.styleSheets[i];
            try {
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
                // --richvdh

                // Yes, tinting assumes that you are using the Element skin for now.
                // The right solution will be to move the CSS over to react-sdk.
                // And yes, the default assets for the base skin might as well use
                // Vector Green as any other colour.
                // --matthew

                // stylesheets we don't have permission to access (eg. ones from extensions) have a null
                // href and will throw exceptions if we try to access their rules.
                if (!ss.href || !ss.href.match(new RegExp('/theme-' + this.theme + '.css$'))) continue;
                if (ss.disabled) continue;
                if (!ss.cssRules) continue;

                if (DEBUG) console.debug("calcCssFixups checking " + ss.cssRules.length + " rules for " + ss.href);

                for (let j = 0; j < ss.cssRules.length; j++) {
                    const rule = ss.cssRules[j];
                    if (!rule.style) continue;
                    if (rule.selectorText && rule.selectorText.match(/#mx_theme/)) continue;
                    for (let k = 0; k < this.cssAttrs.length; k++) {
                        const attr = this.cssAttrs[k];
                        for (let l = 0; l < this.keyRgb.length; l++) {
                            if (rule.style[attr] === this.keyRgb[l]) {
                                this.cssFixups[this.theme].push({
                                    style: rule.style,
                                    attr: attr,
                                    index: l,
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                // Catch any random exceptions that happen here: all sorts of things can go
                // wrong with this (nulls, SecurityErrors) and mostly it's for other
                // stylesheets that we don't want to proces anyway. We should not propagate an
                // exception out since this will cause the app to fail to start.
                console.log("Failed to calculate CSS fixups for a stylesheet: " + ss.href, e);
            }
        }
        if (DEBUG) {
            console.log("calcCssFixups end (" +
                this.cssFixups[this.theme].length +
                " fixups)");
        }
    }

    applyCssFixups() {
        if (DEBUG) {
            console.log("applyCssFixups start (" +
                this.cssFixups[this.theme].length +
                " fixups)");
        }
        for (let i = 0; i < this.cssFixups[this.theme].length; i++) {
            const cssFixup = this.cssFixups[this.theme][i];
            try {
                cssFixup.style[cssFixup.attr] = this.colors[cssFixup.index];
            } catch (e) {
                // Firefox Quantum explodes if you manually edit the CSS in the
                // inspector and then try to do a tint, as apparently all the
                // fixups are then stale.
                console.error("Failed to apply cssFixup in Tinter! ", e.name);
            }
        }
        if (DEBUG) console.log("applyCssFixups end");
    }

    // XXX: we could just move this all into TintableSvg, but as it's so similar
    // to the CSS fixup stuff in Tinter (just that the fixups are stored in TintableSvg)
    // keeping it here for now.
    calcSvgFixups(svgs) {
        // go through manually fixing up SVG colours.
        // we could do this by stylesheets, but keeping the stylesheets
        // updated would be a PITA, so just brute-force search for the
        // key colour; cache the element and apply.

        if (DEBUG) console.log("calcSvgFixups start for " + svgs);
        const fixups = [];
        for (let i = 0; i < svgs.length; i++) {
            let svgDoc;
            try {
                svgDoc = svgs[i].contentDocument;
            } catch (e) {
                let msg = 'Failed to get svg.contentDocument of ' + svgs[i].toString();
                if (e.message) {
                    msg += e.message;
                }
                if (e.stack) {
                    msg += ' | stack: ' + e.stack;
                }
                console.error(msg);
            }
            if (!svgDoc) continue;
            const tags = svgDoc.getElementsByTagName("*");
            for (let j = 0; j < tags.length; j++) {
                const tag = tags[j];
                for (let k = 0; k < this.svgAttrs.length; k++) {
                    const attr = this.svgAttrs[k];
                    for (let l = 0; l < this.keyHex.length; l++) {
                        if (tag.getAttribute(attr) &&
                            tag.getAttribute(attr).toUpperCase() === this.keyHex[l]) {
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
    }

    applySvgFixups(fixups) {
        if (DEBUG) console.log("applySvgFixups start for " + fixups);
        for (let i = 0; i < fixups.length; i++) {
            const svgFixup = fixups[i];
            svgFixup.node.setAttribute(svgFixup.attr, this.colors[svgFixup.index]);
        }
        if (DEBUG) console.log("applySvgFixups end");
    }
}

if (global.singletonTinter === undefined) {
    global.singletonTinter = new Tinter();
}
export default global.singletonTinter;
