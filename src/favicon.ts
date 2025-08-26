/*
Copyright 2020-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

interface IParams {
    // colour parameters
    bgColor: string;
    textColor: string;
    // font styling parameters
    fontFamily: string;
    fontWeight: "normal" | "italic" | "bold" | "bolder" | "lighter" | number;

    // positioning parameters
    isUp: boolean;
    isLeft: boolean;
}

const defaults: IParams = {
    bgColor: "#d00",
    textColor: "#fff",
    fontFamily: "sans-serif", // Arial,Verdana,Times New Roman,serif,sans-serif,...
    fontWeight: "bold", // normal,italic,oblique,bold,bolder,lighter,100,200,300,400,500,600,700,800,900

    isUp: false,
    isLeft: false,
};

abstract class IconRenderer {
    protected readonly canvas: HTMLCanvasElement;
    protected readonly context: CanvasRenderingContext2D;
    public constructor(
        protected readonly params: IParams = defaults,
        protected readonly baseImage?: HTMLImageElement,
    ) {
        this.canvas = document.createElement("canvas");
        const context = this.canvas.getContext("2d");
        if (!context) {
            throw Error("Could not get canvas context");
        }
        this.context = context;
    }

    private options(
        n: number | string,
        params: IParams,
    ): {
        n: string | number;
        len: number;
        x: number;
        y: number;
        w: number;
        h: number;
    } {
        const opt = {
            n: typeof n === "number" ? Math.abs(n | 0) : n,
            len: ("" + n).length,
            // badge positioning constants as percentages
            x: 0.4,
            y: 0.4,
            w: 0.6,
            h: 0.6,
        };

        // apply positional transformations
        if (params.isUp) {
            if (opt.y < 0.6) {
                opt.y = opt.y - 0.4;
            } else {
                opt.y = opt.y - 2 * opt.y + (1 - opt.w);
            }
        }
        if (params.isLeft) {
            if (opt.x < 0.6) {
                opt.x = opt.x - 0.4;
            } else {
                opt.x = opt.x - 2 * opt.x + (1 - opt.h);
            }
        }

        // scale the position to the canvas
        opt.x = this.canvas.width * opt.x;
        opt.y = this.canvas.height * opt.y;
        opt.w = this.canvas.width * opt.w;
        opt.h = this.canvas.height * opt.h;
        return opt;
    }

    /**
     * Draws a circualr status icon, usually over the top of the application icon.
     * @param n The content of the circle. Should be a number or a single character.
     * @param opts Options to adjust.
     */
    protected circle(n: number | string, opts?: Partial<IParams>): void {
        const params = { ...this.params, ...opts };
        const opt = this.options(n, params);

        let more = false;
        if (!this.baseImage) {
            // If we omit the background, assume the entire canvas is our target.
            opt.x = 0;
            opt.y = 0;
            opt.w = this.canvas.width;
            opt.h = this.canvas.height;
        }
        if (opt.len === 2) {
            opt.x = opt.x - opt.w * 0.4;
            opt.w = opt.w * 1.4;
            more = true;
        } else if (opt.len >= 3) {
            opt.x = opt.x - opt.w * 0.65;
            opt.w = opt.w * 1.65;
            more = true;
        }

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.baseImage) {
            this.context.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height);
        }
        this.context.beginPath();
        const fontSize = Math.floor(opt.h * (typeof opt.n === "number" && opt.n > 99 ? 0.85 : 1)) + "px";
        this.context.font = `${params.fontWeight} ${fontSize} ${params.fontFamily}`;
        this.context.textAlign = "center";

        if (more) {
            this.context.moveTo(opt.x + opt.w / 2, opt.y);
            this.context.lineTo(opt.x + opt.w - opt.h / 2, opt.y);
            this.context.quadraticCurveTo(opt.x + opt.w, opt.y, opt.x + opt.w, opt.y + opt.h / 2);
            this.context.lineTo(opt.x + opt.w, opt.y + opt.h - opt.h / 2);
            this.context.quadraticCurveTo(opt.x + opt.w, opt.y + opt.h, opt.x + opt.w - opt.h / 2, opt.y + opt.h);
            this.context.lineTo(opt.x + opt.h / 2, opt.y + opt.h);
            this.context.quadraticCurveTo(opt.x, opt.y + opt.h, opt.x, opt.y + opt.h - opt.h / 2);
            this.context.lineTo(opt.x, opt.y + opt.h / 2);
            this.context.quadraticCurveTo(opt.x, opt.y, opt.x + opt.h / 2, opt.y);
        } else {
            this.context.arc(opt.x + opt.w / 2, opt.y + opt.h / 2, opt.h / 2, 0, 2 * Math.PI);
        }

        this.context.fillStyle = params.bgColor;
        this.context.fill();
        this.context.closePath();
        this.context.beginPath();
        this.context.stroke();
        this.context.fillStyle = params.textColor;

        if (typeof opt.n === "number" && opt.n > 999) {
            const count = (opt.n > 9999 ? 9 : Math.floor(opt.n / 1000)) + "k+";
            this.context.fillText(count, Math.floor(opt.x + opt.w / 2), Math.floor(opt.y + opt.h - opt.h * 0.2));
        } else {
            this.context.fillText("" + opt.n, Math.floor(opt.x + opt.w / 2), Math.floor(opt.y + opt.h - opt.h * 0.15));
        }

        this.context.closePath();
    }
}

export class BadgeOverlayRenderer extends IconRenderer {
    public constructor() {
        super();
        // Overlays are 16x16 https://www.electronjs.org/docs/latest/api/browser-window#winsetoverlayiconoverlay-description-windows
        this.canvas.width = 16;
        this.canvas.height = 16;
    }

    /**
     * Generate an overlay badge without the application icon, and export
     * as an ArrayBuffer
     * @param contents The content of the circle. Should be a number or a single character.
     * @param bgColor Optional alternative background colo.r
     * @returns An ArrayBuffer representing a 16x16 icon in `image/png` format, or `null` if no badge should be drawn.
     */
    public async render(contents: number | string, bgColor?: string): Promise<ArrayBuffer | null> {
        if (contents === 0) {
            return null;
        }

        this.circle(contents, { ...(bgColor ? { bgColor } : undefined) });
        return new Promise((resolve, reject) => {
            this.canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob.arrayBuffer());
                    }
                    reject(new Error("Could not render badge overlay as blob"));
                },
                "image/png",
                1,
            );
        });
    }
}

// Allows dynamic rendering of a circular badge atop the loaded favicon
// supports colour, font and basic positioning parameters.
// Based upon https://github.com/ejci/favico.js/blob/master/favico.js [MIT license]
export default class Favicon extends IconRenderer {
    private readonly browser = {
        ff: typeof window.InstallTrigger !== "undefined",
        opera: !!window.opera || navigator.userAgent.includes("Opera"),
    };

    private icons: HTMLLinkElement[];

    private isReady = false;
    // callback to run once isReady is asserted, allows for a badge to be queued for when it can be shown
    private readyCb?: () => void;

    public constructor() {
        const baseImage = document.createElement("img");
        super(defaults, baseImage);

        this.icons = Favicon.getIcons();

        const lastIcon = this.icons[this.icons.length - 1];
        if (lastIcon.hasAttribute("href")) {
            baseImage.setAttribute("crossOrigin", "anonymous");
            baseImage.onload = (): void => {
                // get height and width of the favicon
                this.canvas.height = baseImage.height > 0 ? baseImage.height : 32;
                this.canvas.width = baseImage.width > 0 ? baseImage.width : 32;
                this.ready();
            };
            baseImage.setAttribute("src", lastIcon.getAttribute("href")!);
        } else {
            this.canvas.height = baseImage.height = 32;
            this.canvas.width = baseImage.width = 32;
            this.ready();
        }
    }

    private reset(): void {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.baseImage!, 0, 0, this.canvas.width, this.canvas.height);
    }

    private ready(): void {
        if (this.isReady) return;
        this.isReady = true;
        this.readyCb?.();
    }

    private setIcon(canvas: HTMLCanvasElement): void {
        setTimeout(() => {
            this.setIconSrc(canvas.toDataURL("image/png"));
        }, 0);
    }

    private setIconSrc(url: string): void {
        // if is attached to fav icon
        if (this.browser.ff || this.browser.opera) {
            // for FF we need to "recreate" element, attach to dom and remove old <link>
            const old = this.icons[this.icons.length - 1];
            const newIcon = window.document.createElement("link");
            this.icons = [newIcon];
            newIcon.setAttribute("rel", "icon");
            newIcon.setAttribute("type", "image/png");
            window.document.getElementsByTagName("head")[0].appendChild(newIcon);
            newIcon.setAttribute("href", url);
            old.parentNode?.removeChild(old);
        } else {
            this.icons.forEach((icon) => {
                icon.setAttribute("href", url);
            });
        }
    }

    public badge(content: number | string, opts?: Partial<IParams>): void {
        if (!this.isReady) {
            this.readyCb = (): void => {
                this.badge(content, opts);
            };
            return;
        }

        if (typeof content === "string" || content > 0) {
            this.circle(content, opts);
        } else {
            this.reset();
        }

        this.setIcon(this.canvas);
    }

    private static getLinks(): HTMLLinkElement[] {
        const icons: HTMLLinkElement[] = [];
        const links = window.document.getElementsByTagName("head")[0].getElementsByTagName("link");
        for (const link of links) {
            if (link.hasAttribute("rel") && /(^|\s)icon(\s|$)/i.test(link.getAttribute("rel")!)) {
                icons.push(link);
            }
        }
        return icons;
    }

    private static getIcons(): HTMLLinkElement[] {
        // get favicon link elements
        let elms = Favicon.getLinks();
        if (elms.length === 0) {
            elms = [window.document.createElement("link")];
            elms[0].setAttribute("rel", "icon");
            window.document.getElementsByTagName("head")[0].appendChild(elms[0]);
        }

        elms.forEach((item) => {
            item.setAttribute("type", "image/png");
        });
        return elms;
    }
}
