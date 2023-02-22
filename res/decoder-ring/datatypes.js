/*
 * Quick-n-dirty algebraic datatypes.
 *
 * These let us handle the possibility of failure without having to constantly write code to check for it.
 * We can apply all of the transformations we need as if the data is present using `map`.
 * If there's a None, or a FetchError, or a Pending, those are left untouched.
 *
 * I've used perhaps an odd bit of terminology from scalaz in `fold`.  This is basically a `switch` statement:
 * You pass it a set of functions to handle the various different states of the datatype, and if it finds the
 * function it'll call it on its value.
 *
 * It's handy to have this in functional style when dealing with React as we can dispatch different ways of rendering
 * really simply:
 * ```
 * bundleFetchStatus.fold({
 *     some: (fetchStatus) => <ProgressBar fetchsStatus={fetchStatus} />,
 * }),
 * ```
 */

class Optional {
    static from(value) {
        return (value && Some.of(value)) || None;
    }
    map(f) {
        return this;
    }
    flatMap(f) {
        return this;
    }
    fold({ none }) {
        return none && none();
    }
}
class Some extends Optional {
    constructor(value) {
        super();
        this.value = value;
    }
    map(f) {
        return Some.of(f(this.value));
    }
    flatMap(f) {
        return f(this.value);
    }
    fold({ some }) {
        return some && some(this.value);
    }
    static of(value) {
        return new Some(value);
    }
}
const None = new Optional();

class FetchStatus {
    constructor(opt = {}) {
        this.opt = { at: Date.now(), ...opt };
    }
    map(f) {
        return this;
    }
    flatMap(f) {
        return this;
    }
}
class Success extends FetchStatus {
    static of(value) {
        return new Success(value);
    }
    constructor(value, opt) {
        super(opt);
        this.value = value;
    }
    map(f) {
        return new Success(f(this.value), this.opt);
    }
    flatMap(f) {
        return f(this.value, this.opt);
    }
    fold({ success }) {
        return success instanceof Function ? success(this.value, this.opt) : undefined;
    }
}
class Pending extends FetchStatus {
    static of(opt) {
        return new Pending(opt);
    }
    constructor(opt) {
        super(opt);
    }
    fold({ pending }) {
        return pending instanceof Function ? pending(this.opt) : undefined;
    }
}
class FetchError extends FetchStatus {
    static of(reason, opt) {
        return new FetchError(reason, opt);
    }
    constructor(reason, opt) {
        super(opt);
        this.reason = reason;
    }
    fold({ error }) {
        return error instanceof Function ? error(this.reason, this.opt) : undefined;
    }
}
