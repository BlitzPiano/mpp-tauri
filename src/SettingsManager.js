const arrayOrStringEquals = (a, b) => (Array.isArray(a) && Array.isArray(b)) ? a.length === b.length && a.every((val, index) => val === b[index]) : a === b;

// This works across tabs
class SettingsManager extends EventEmitter {
    constructor() {
        super()
        this.read()
        window.addEventListener("storage", () => this.read())
    }

    read() {
        for (const prop in this.settings) {
            const uProp = "_" + prop
            const now = this.settings[prop](localStorage.getItem(prop))
            if (!arrayOrStringEquals(this[uProp], now)) {
                this.emit(prop, this[uProp] = now)
            }
        }
    }

    emitAll() {
        for (const prop in this.settings) {
            this.emit(prop, this["_" + prop])
        }
    }
}

(() => {
    function setupProperties(target, props) {
        target.settings = props
        for (const prop in props) {
            const uProp = "_" + prop
            Object.defineProperty(target, prop, {
                get() { return this[uProp] },
                set(value) { 
                    this[uProp] = value
                    this.emit(prop, value)
                    localStorage.setItem(prop, String(value))
                },
            })
        }
    }

    const identity = (v) => v
    const isTrue = (v) => v == "true"
    const split = (v) => v ? v.split(",").filter(identity) : []

    setupProperties(SettingsManager.prototype, {
        pianoMutes: split,
        chatMutes: split,
        showIdsInChat: isTrue,
        showTimestampsInChat: isTrue,
        noChatColors: isTrue,
        noBackgroundColor: isTrue,
        outputOwnNotes: isTrue,
        virtualPianoLayout: isTrue,
        smoothCursor: isTrue,
        showChatTooltips: isTrue,
        showPianoNotes: isTrue,
        highlightScaleNotes: identity,
        cursorHides: split,
        hideAllCursors: isTrue,
        hidePiano: isTrue,
        hideChat: isTrue,
        noPreventDefault: isTrue,
    })
})();