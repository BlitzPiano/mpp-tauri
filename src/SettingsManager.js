class SettingsManager extends EventEmitter {
    constructor() {
        super()
        this.read()
        window.addEventListener("storage", () => this.read())
    }

    read() {
        // TODO: Fire events here

        this._pianoMutes = (localStorage.pianoMutes ?? "").split(",").filter((v) => v)
        this._chatMutes = (localStorage.chatMutes ?? "").split(",").filter((v) => v)
        this._showIdsInChat = localStorage.showIdsInChat == "true"
        this._showTimestampsInChat = localStorage.showTimestampsInChat == "true"
        this._noChatColors = localStorage.noChatColors == "true"
        this._noBackgroundColor = localStorage.noBackgroundColor == "true"
        this._outputOwnNotes = localStorage.outputOwnNotes ? localStorage.outputOwnNotes == "true" : true
        this._virtualPianoLayout = localStorage.virtualPianoLayout == "true"
        this._smoothCursor = localStorage.smoothCursor == "true"
        this._showChatTooltips = localStorage.showChatTooltips ? localStorage.showChatTooltips == "true" : true
        this._showPianoNotes = localStorage.showPianoNotes == "true"
        this._highlightScaleNotes = localStorage.highlightScaleNotes
        this._cursorHides = (localStorage.cursorHides ?? "").split(",").filter((v) => v)
        this._hideAllCursors = localStorage.hideAllCursors == "true"
        this._hidePiano = localStorage.hidePiano == "true"
        this._hideChat = localStorage.hideChat == "true"
        this._noPreventDefault = localStorage.noPreventDefault == "true"
    }

    emitAll() {
        for (const setting in this.settings) {
            this.emit(setting, this[setting])
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

    const join = (v) => v.join(",")
    setupProperties(SettingsManager.prototype, {
        pianoMutes: join,
        chatMutes: join,
        showIdsInChat: null,
        showTimestampsInChat: null,
        noChatColors: null,
        noBackgroundColor: null,
        outputOwnNotes: null,
        virtualPianoLayout: null,
        smoothCursor: null,
        showChatTooltips: null,
        showPianoNotes: null,
        highlightScaleNotes: null,
        cursorHides: join,
        hideAllCursors: null,
        hidePiano: null,
        hideChat: null,
        noPreventDefault: null,
    })
})();