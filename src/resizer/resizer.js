import {Sizer} from "./sizer";

/*
classNames:
    // class on resize-handle
    handle: string
    // class on resize-handle
    reverse: string
    // class on resize-handle
    vertical: string
    // class on container
    resizing: string
*/

export class Resizer {
    constructor(container, distributorCtor, distributorCfg, sizerCtor = Sizer) {
        this.container = container;
        this.distributorCtor = distributorCtor;
        this.distributorCfg = distributorCfg;
        this.sizerCtor = sizerCtor;
        this.classNames = {
            handle: "resizer-handle",
            reverse: "resizer-reverse",
            vertical: "resizer-vertical",
            resizing: "resizer-resizing",
        };
        this.mouseDownHandler = (event) => this._onMouseDown(event);
    }

    setClassNames(classNames) {
        this.classNames = classNames;
    }

    attach() {
        this.container.addEventListener("mousedown", this.mouseDownHandler, false);
    }

    detach() {
        this.container.removeEventListener("mousedown", this.mouseDownHandler, false);
    }

    _isResizeHandle(el) {
        return el && el.classList.contains(this.classNames.handle);
    }

    _onMouseDown(event) {
        const target = event.target;
        if (!this._isResizeHandle(target) || target.parentElement !== this.container) {
            return;
        }
        // prevent starting a drag operation
        event.preventDefault();
        // mark as currently resizing
        if (this.classNames.resizing) {
            this.container.classList.add(this.classNames.resizing);
        }

        const resizeHandle = event.target;
        const vertical = resizeHandle.classList.contains(this.classNames.vertical);
        const reverse = resizeHandle.classList.contains(this.classNames.reverse);
        const direction = reverse ? 0 : -1;

        const sizer = new this.sizerCtor(this.container, vertical, reverse);

        const items = Array.from(this.container.children).filter(el => {
            return !this._isResizeHandle(el) && (
                this._isResizeHandle(el.previousElementSibling) ||
                this._isResizeHandle(el.nextElementSibling));
        });
        const prevItem = resizeHandle.previousElementSibling;
        const handleIndex = items.indexOf(prevItem) + 1;
        const distributor = new this.distributorCtor(
            this.container, items, handleIndex,
            direction, sizer, this.distributorCfg);

        const onMouseMove = (event) => {
            const offset = sizer.offsetFromEvent(event);
            distributor.resize(offset);
        };

        const body = document.body;
        const onMouseUp = (event) => {
            if (this.classNames.resizing) {
                this.container.classList.remove(this.classNames.resizing);
            }
            const offset = sizer.offsetFromEvent(event);
            distributor.finish(offset);
            body.removeEventListener("mouseup", onMouseUp, false);
            body.removeEventListener("mousemove", onMouseMove, false);
        };
        body.addEventListener("mouseup", onMouseUp, false);
        body.addEventListener("mousemove", onMouseMove, false);
    }
}
