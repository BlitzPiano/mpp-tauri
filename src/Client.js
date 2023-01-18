const { appWindow } = window.__TAURI__.window

class Client extends EventEmitter {
  constructor(uri) {
    super()

    this.uri = uri
    this.ws = undefined
    this.serverTimeOffset = 0
    this.user = undefined
    this.participantId = undefined
    this.channel = undefined
    this.ppl = {}
    this.connectionTime = undefined
    this.connectionAttempts = 0
    this.desiredChannelId = undefined
    this.desiredChannelSettings = undefined
    this.pingInterval = undefined
    this.canConnect = false
    this.noteBuffer = []
    this.noteBufferTime = 0
    this.noteFlushInterval = undefined
    this.permissions = {}
    this["🐈"] = 0
    this.loginInfo = undefined

    this.bindEventListeners()

    this.emit("status", "(Offline mode)")
    appWindow.setTitle("Disconnected")
  }

  isSupported() {
    return true
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  isConnecting() {
    return this.ws && this.ws.readyState === WebSocket.CONNECTING
  }

  start() {
    this.canConnect = true
    if (!this.connectionTime) {
      this.connect()
    }
  }

  stop() {
    this.canConnect = false
    this.ws.close()
  }

  connect() {
    if (!this.canConnect || this.isConnected() || this.isConnecting()) return
    this.emit("status", "Connecting...")
    appWindow.setTitle(`Connecting to ${new URL(this.uri).hostname}`)
    this.ws = new WebSocket(this.uri)

    this.ws.addEventListener("close", (evt) => {
      this.user = undefined
      this.participantId = undefined
      this.channel = undefined
      this.setParticipants([])
      clearInterval(this.pingInterval)
      clearInterval(this.noteFlushInterval)

      this.emit("disconnect", evt)
      this.emit("status", "Offline mode")
      appWindow.setTitle("Disconnected")

      // reconnect!
      if (this.connectionTime) {
        this.connectionTime = undefined
        this.connectionAttempts = 0
      } else {
        ++this.connectionAttempts
      }
      const ms_lut = [50, 2500, 10000]
      let idx = this.connectionAttempts
      if (idx >= ms_lut.length) idx = ms_lut.length - 1
      setTimeout(this.connect.bind(this), ms_lut[idx])
    })
    this.ws.addEventListener("error", (err) => {
      this.emit("wserror", err)
      this.ws.close() // this.ws.emit("close");
    })
    this.ws.addEventListener("open", (evt) => {
      this.pingInterval = setInterval(() => {
        this.sendPing()
      }, 20000)
      this.noteBuffer = []
      this.noteBufferTime = 0
      this.noteFlushInterval = setInterval(() => {
        if (this.noteBufferTime && this.noteBuffer.length > 0) {
          this.sendArray([{ m: "n", t: this.noteBufferTime + this.serverTimeOffset, n: this.noteBuffer }])
          this.noteBufferTime = 0
          this.noteBuffer = []
        }
      }, 200)

      this.emit("connect")
      this.emit("status", "Joining channel...")
    })
    this.ws.addEventListener("message", async (evt) => {
      const transmission = JSON.parse(evt.data)
      for (let i = 0; i < transmission.length; i++) {
        const msg = transmission[i]
        this.emit(msg.m, msg)
      }
    })
  }

  bindEventListeners() {
    this.on("hi", (msg) => {
      this.connectionTime = Date.now()
      this.user = msg.u
      this.receiveServerTime(msg.t, msg.e || undefined)
      if (this.desiredChannelId) {
        this.setChannel()
      }
      if (msg.token) localStorage.token = msg.token
      if (msg.permissions) {
        this.permissions = msg.permissions
      } else {
        this.permissions = {}
      }
      if (msg.accountInfo) {
        this.accountInfo = msg.accountInfo
      } else {
        this.accountInfo = undefined
      }
    })
    this.on("t", (msg) => {
      this.receiveServerTime(msg.t, msg.e || undefined)
    })
    this.on("ch", (msg) => {
      this.desiredChannelId = msg.ch._id
      this.desiredChannelSettings = msg.ch.settings
      this.channel = msg.ch
      if (msg.p) this.participantId = msg.p
      this.setParticipants(msg.ppl)
      appWindow.setTitle(`${new URL(this.uri).hostname} - ${msg.ch.id}`)
    })
    this.on("p", (msg) => {
      this.participantUpdate(msg)
      this.emit("participant update", this.findParticipantById(msg.id))
    })
    this.on("m", (msg) => {
      if (this.ppl.hasOwnProperty(msg.id)) {
        this.participantMoveMouse(msg)
      }
    })
    this.on("bye", (msg) => {
      this.removeParticipant(msg.p)
    })
    this.on("b", (msg) => {
      const hiMsg = { m: "hi" }
      hiMsg["🐈"] = this["🐈"]++ || undefined
      if (this.loginInfo) hiMsg.login = this.loginInfo
      this.loginInfo = undefined
      try {
        if (msg.code.startsWith("~")) {
          hiMsg.code = Function(msg.code.substring(1))()
        } else {
          hiMsg.code = Function(msg.code)()
        }
      } catch (err) {
        hiMsg.code = "broken"
      }
      if (localStorage.token) {
        hiMsg.token = localStorage.token
      }
      this.sendArray([hiMsg])
    })
  }

  send(raw) {
    if (this.isConnected()) this.ws.send(raw)
  }

  sendArray(arr) {
    this.send(JSON.stringify(arr))
  }

  setChannel(id, set) {
    this.desiredChannelId = id || this.desiredChannelId || "lobby"
    this.desiredChannelSettings = set || this.desiredChannelSettings || undefined
    this.sendArray([{ m: "ch", _id: this.desiredChannelId, set: this.desiredChannelSettings }])
  }

  offlineChannelSettings = {
    color: "#ecfaed",
  }

  getChannelSetting(key) {
    if (!this.isConnected() || !this.channel || !this.channel.settings) {
      return this.offlineChannelSettings[key]
    }
    return this.channel.settings[key]
  }

  setChannelSettings(settings) {
    if (!this.isConnected() || !this.channel || !this.channel.settings) {
      return
    }
    if (this.desiredChannelSettings) {
      for (const key in settings) {
        this.desiredChannelSettings[key] = settings[key]
      }
      this.sendArray([{ m: "chset", set: this.desiredChannelSettings }])
    }
  }

  offlineParticipant = {
    _id: "",
    name: "",
    color: "#777",
  }

  getOwnParticipant() {
    return this.findParticipantById(this.participantId)
  }

  setParticipants(ppl) {
    // remove participants who left
    for (const id in this.ppl) {
      if (!this.ppl.hasOwnProperty(id)) continue
      let found = false
      for (let j = 0; j < ppl.length; j++) {
        if (ppl[j].id === id) {
          found = true
          break
        }
      }
      if (!found) {
        this.removeParticipant(id)
      }
    }
    // update all
    for (let i = 0; i < ppl.length; i++) {
      this.participantUpdate(ppl[i])
    }
  }

  countParticipants() {
    let count = 0
    for (const i in this.ppl) {
      if (this.ppl.hasOwnProperty(i)) ++count
    }
    return count
  }

  participantUpdate(update) {
    let part = this.ppl[update.id] || null
    if (part === null) {
      part = update
      this.ppl[part.id] = part
      this.emit("participant added", part)
      this.emit("count", this.countParticipants())
    } else {
      Object.keys(update).forEach((key) => {
        part[key] = update[key]
      })
      if (!update.tag) delete part.tag
      if (!update.vanished) delete part.vanished
    }
  }

  participantMoveMouse(update) {
    const part = this.ppl[update.id] || null
    if (part !== null) {
      part.x = update.x
      part.y = update.y
    }
  }

  removeParticipant(id) {
    if (this.ppl.hasOwnProperty(id)) {
      const part = this.ppl[id]
      delete this.ppl[id]
      this.emit("participant removed", part)
      this.emit("count", this.countParticipants())
    }
  }

  findParticipantById(id) {
    return this.ppl[id] || this.offlineParticipant
  }

  isOwner() {
    return this.channel && this.channel.crown && this.channel.crown.participantId === this.participantId
  }

  preventsPlaying() {
    return (
      this.isConnected() &&
      !this.isOwner() &&
      this.getChannelSetting("crownsolo") === true &&
      !this.permissions.playNotesAnywhere
    )
  }

  receiveServerTime(time, echo) {
    const target = time - Date.now()
    const duration = 1000
    let step = 0
    const steps = 50
    const step_ms = duration / steps
    const difference = target - this.serverTimeOffset
    const inc = difference / steps

    const iv = setInterval(() => {
      this.serverTimeOffset += inc
      if (++step >= steps) {
        clearInterval(iv)
        this.serverTimeOffset = target
      }
    }, step_ms)
  }

  startNote(note, vel) {
    if (typeof note !== "string") return
    if (this.isConnected()) {
      vel = typeof vel === "undefined" ? undefined : +vel.toFixed(3)
      if (!this.noteBufferTime) {
        this.noteBufferTime = Date.now()
        this.noteBuffer.push({ n: note, v: vel })
      } else {
        this.noteBuffer.push({ d: Date.now() - this.noteBufferTime, n: note, v: vel })
      }
    }
  }

  stopNote(note) {
    if (typeof note !== "string") return
    if (this.isConnected()) {
      if (!this.noteBufferTime) {
        this.noteBufferTime = Date.now()
        this.noteBuffer.push({ n: note, s: 1 })
      } else {
        this.noteBuffer.push({ d: Date.now() - this.noteBufferTime, n: note, s: 1 })
      }
    }
  }

  sendPing() {
    this.sendArray([{ m: "t", e: Date.now() }])
  }

  setLoginInfo(loginInfo) {
    this.loginInfo = loginInfo
  }
}