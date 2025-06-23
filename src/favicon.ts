/*
Copyright 2020-2024 New Vector Ltd.

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

// Allows dynamic rendering of a circular badge atop the loaded favicon
// supports colour, font and basic positioning parameters.
// Based upon https://github.com/ejci/favico.js/blob/master/favico.js [MIT license]
export default class Favicon {
    private readonly browser = {
        ff: typeof window.InstallTrigger !== "undefined",
        opera: !!window.opera || navigator.userAgent.includes("Opera"),
    };

    private readonly params: IParams;
    private readonly canvas: HTMLCanvasElement;
    private readonly baseImage: HTMLImageElement;
    private context!: CanvasRenderingContext2D;
    private icons: HTMLLinkElement[];

    private isReady = false;
    // callback to run once isReady is asserted, allows for a badge to be queued for when it can be shown
    private readyCb?: () => void;

    public constructor(params: Partial<IParams> = {}) {
        this.params = { ...defaults, ...params };

        this.icons = Favicon.getIcons();
        // create work canvas
        this.canvas = document.createElement("canvas");
        // create clone of favicon as a base
        this.baseImage = document.createElement("img");

        const lastIcon = this.icons[this.icons.length - 1];
        if (lastIcon.hasAttribute("href")) {
            this.baseImage.setAttribute("crossOrigin", "anonymous");
            this.baseImage.onload = (): void => {
                // get height and width of the favicon
                this.canvas.height = this.baseImage.height > 0 ? this.baseImage.height : 32;
                this.canvas.width = this.baseImage.width > 0 ? this.baseImage.width : 32;
                this.context = this.canvas.getContext("2d")!;
                this.ready();
            };
            this.baseImage.setAttribute("src", lastIcon.getAttribute("href")!);
        } else {
            this.canvas.height = this.baseImage.height = 32;
            this.canvas.width = this.baseImage.width = 32;
            this.context = this.canvas.getContext("2d")!;
            this.ready();
        }
    }

    private reset(): void {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height);
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

    private circle(n: number | string, opts?: Partial<IParams>): void {
        const params = { ...this.params, ...opts };
        const opt = this.options(n, params);

        let more = false;
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
        this.context.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height);
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
