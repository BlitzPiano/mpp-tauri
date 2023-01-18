"use strict"

// Soundpack Stuff by electrashave ♥

var soundDomain = `http://${location.host}`

class SoundSelector {
  constructor(piano) {
    this.initialized = false
    this.keys = piano.keys
    this.loading = {}
    this.notification
    this.packs = []
    this.piano = piano
    this.soundSelection = localStorage.soundSelection ? localStorage.soundSelection : "mppclassic"
    this.addPack({ name: "MPP Classic", keys: Object.keys(this.piano.keys), ext: ".mp3", url: "/sounds/mppclassic/" })
  }

  addPack(pack, load) {
    var self = this
    self.loading[pack.url || pack] = true
    function add(obj) {
      var added = false
      for (var i = 0; self.packs.length > i; i++) {
        if (obj.name == self.packs[i].name) {
          added = true
          break
        }
      }

      if (added) return console.warn("Sounds already added!!") //no adding soundpacks twice D:<

      if (obj.url.substr(obj.url.length - 1) != "/") obj.url = obj.url + "/"
      var html = document.createElement("li")
      html.classList = "pack"
      html.innerText = obj.name + " (" + obj.keys.length + " keys)"
      html.onclick = function () {
        self.loadPack(obj.name)
        self.notification.close()
      }
      obj.html = html
      self.packs.push(obj)
      self.packs.sort(function (a, b) {
        if (a.name < b.name) return -1
        if (a.name > b.name) return 1
        return 0
      })
      if (load) self.loadPack(obj.name)
      delete self.loading[obj.url]
    }

    if (typeof pack == "string") {
      let useDomain = true
      if (pack.match(/^(http|https):\/\//i)) useDomain = false
      $.getJSON((useDomain ? soundDomain : "") + pack + "/info.json").done(function (json) {
        json.url = pack
        add(json)
      })
    } else add(pack) //validate packs??
  }

  addPacks(packs) {
    for (const pack of packs) this.addPack(pack)
  }

  init() {
    var self = this
    if (self.initialized) return console.warn("Sound selector already initialized!")

    if (!!Object.keys(self.loading).length)
      return setTimeout(function () {
        self.init()
      }, 250)

    $("#sound-btn").on("click", function () {
      if (document.getElementById("Notification-Sound-Selector") != null) return self.notification.close()
      var html = document.createElement("ul")
      //$(html).append("<p>Current Sound: " + self.soundSelection + "</p>");
      for (var i = 0; self.packs.length > i; i++) {
        var pack = self.packs[i]
        if (pack.name == self.soundSelection) pack.html.classList = "pack enabled"
        else pack.html.classList = "pack"
        html.appendChild(pack.html)
      }

      self.notification = new MPP.Notification({
        title: "Sound Selector",
        html: html,
        id: "Sound-Selector",
        duration: -1,
        target: "#sound-btn",
      })
    })
    self.initialized = true
    self.loadPack(self.soundSelection, true)
  }

  loadPack(pack, f) {
    for (var i = 0; this.packs.length > i; i++) {
      var p = this.packs[i]
      if (p.name == pack) {
        pack = p
        break
      }
    }
    if (typeof pack == "string") {
      console.warn("Sound pack does not exist! Loading default pack...")
      return this.loadPack("MPP Classic")
    }

    if (pack.name == this.soundSelection && !f) return
    if (pack.keys.length != Object.keys(this.piano.keys).length) {
      this.piano.keys = {}
      for (var i = 0; pack.keys.length > i; i++) this.piano.keys[pack.keys[i]] = this.keys[pack.keys[i]]
      this.piano.renderer.resize()
    }

    var self = this
    for (var i in this.piano.keys) {
      if (!this.piano.keys.hasOwnProperty(i)) continue
      ;(function () {
        var key = self.piano.keys[i]
        key.loaded = false
        let useDomain = true
        if (pack.url.match(/^(http|https):\/\//i)) useDomain = false
        self.piano.audio.load(key.note, (useDomain ? soundDomain : "") + pack.url + key.note + pack.ext, function () {
          key.loaded = true
          key.timeLoaded = Date.now()
        })
      })()
    }
    if (localStorage) localStorage.soundSelection = pack.name
    this.soundSelection = pack.name
  }

  removePack(name) {
    var found = false
    for (var i = 0; this.packs.length > i; i++) {
      var pack = this.packs[i]
      if (pack.name == name) {
        this.packs.splice(i, 1)
        if (pack.name == this.soundSelection) this.loadPack(this.packs[0].name) //add mpp default if none?
        break
      }
    }
    if (!found) console.warn("Sound pack not found!")
  }
}
